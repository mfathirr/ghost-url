package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/ghost-url/backend/internal/config"
	"github.com/ghost-url/backend/internal/models"
	"github.com/ghost-url/backend/internal/storage"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// mockStore implements storage.LinkStore in-memory for testing.
type mockStore struct {
	mu    sync.RWMutex
	links map[string]*models.StoredLink
	ttls  map[string]time.Duration
}

func newMockStore() *mockStore {
	return &mockStore{
		links: make(map[string]*models.StoredLink),
		ttls:  make(map[string]time.Duration),
	}
}

func (m *mockStore) SaveLink(_ context.Context, slug string, link *models.StoredLink, ttl time.Duration, checkCollision bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if checkCollision {
		if _, exists := m.links[slug]; exists {
			return storage.ErrSlugCollision
		}
	}
	m.links[slug] = link
	m.ttls[slug] = ttl
	return nil
}

func (m *mockStore) GetLink(_ context.Context, slug string) (*models.StoredLink, time.Duration, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	link, exists := m.links[slug]
	if !exists {
		return nil, 0, storage.ErrLinkNotFound
	}
	return link, m.ttls[slug], nil
}

func (m *mockStore) Exists(_ context.Context, slug string) (bool, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	_, exists := m.links[slug]
	return exists, nil
}

func (m *mockStore) Ping(_ context.Context) error {
	return nil
}

func (m *mockStore) Close() error {
	return nil
}

func setupTestRouter(store storage.LinkStore) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	cfg := &config.Config{
		BaseURL:      "http://localhost:8080",
		FrontendURL:  "http://localhost:5173",
		ReadTimeout:  2 * time.Second,
		WriteTimeout: 2 * time.Second,
	}
	handler := NewLinkHandler(store, cfg)

	api := r.Group("/api")
	{
		api.POST("/links", handler.CreateLink)
		api.GET("/links/:slug", handler.GetLinkMetadata)
		api.POST("/links/:slug/unlock", handler.UnlockLink)
	}
	r.GET("/r/:slug", handler.RedirectLink)
	r.GET("/health", handler.HealthCheck)

	return r
}

func TestCreateLink(t *testing.T) {
	store := newMockStore()
	router := setupTestRouter(store)

	tests := []struct {
		name       string
		payload    map[string]interface{}
		wantStatus int
	}{
		{
			name: "valid link creation without alias or passcode",
			payload: map[string]interface{}{
				"url":        "https://google.com",
				"expires_in": "1h",
			},
			wantStatus: http.StatusCreated,
		},
		{
			name: "valid link creation with custom alias and passcode",
			payload: map[string]interface{}{
				"url":        "https://github.com",
				"alias":      "my-git",
				"passcode":   "secret123",
				"expires_in": "5m",
			},
			wantStatus: http.StatusCreated,
		},
		{
			name: "duplicate custom alias returns 409 conflict",
			payload: map[string]interface{}{
				"url":        "https://github.com/duplicate",
				"alias":      "my-git",
				"expires_in": "5m",
			},
			wantStatus: http.StatusConflict,
		},
		{
			name: "invalid url scheme returns 400",
			payload: map[string]interface{}{
				"url": "not-a-valid-url",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "reserved alias returns 400",
			payload: map[string]interface{}{
				"url":   "https://valid.com",
				"alias": "api",
			},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			body, _ := json.Marshal(tt.payload)
			req, _ := http.NewRequest(http.MethodPost, "/api/links", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("POST /api/links code = %d, want %d, body = %s", w.Code, tt.wantStatus, w.Body.String())
			}
		})
	}
}

func TestPasscodeUnlockAndRedirect(t *testing.T) {
	store := newMockStore()
	router := setupTestRouter(store)

	// Create a passcode-protected link in store
	hash, err := bcrypt.GenerateFromPassword([]byte("pass123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("failed to hash passcode: %v", err)
	}

	now := time.Now()
	err = store.SaveLink(context.Background(), "secure-slug", &models.StoredLink{
		URL:          "https://destination.com/secret",
		PasscodeHash: string(hash),
		CreatedAt:    now,
		ExpiresAt:    now.Add(time.Hour),
	}, time.Hour, false)
	if err != nil {
		t.Fatalf("failed to seed store: %v", err)
	}

	// Create an unprotected link
	err = store.SaveLink(context.Background(), "public-slug", &models.StoredLink{
		URL:       "https://public.com",
		CreatedAt: now,
		ExpiresAt: now.Add(time.Hour),
	}, time.Hour, false)
	if err != nil {
		t.Fatalf("failed to seed public link: %v", err)
	}

	t.Run("public link direct 302 redirect", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/r/public-slug", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusFound {
			t.Errorf("expected 302 redirect, got %d", w.Code)
		}
		if loc := w.Header().Get("Location"); loc != "https://public.com" {
			t.Errorf("expected Location https://public.com, got %s", loc)
		}
	})

	t.Run("protected link unlock with wrong passcode returns 401", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"passcode": "wrong-password"})
		req, _ := http.NewRequest(http.MethodPost, "/api/links/secure-slug/unlock", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized, got %d", w.Code)
		}
	})

	t.Run("protected link unlock with correct passcode returns 200 and URL", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"passcode": "pass123"})
		req, _ := http.NewRequest(http.MethodPost, "/api/links/secure-slug/unlock", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected 200 OK, got %d", w.Code)
		}

		var resp models.UnlockResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if resp.URL != "https://destination.com/secret" {
			t.Errorf("expected URL https://destination.com/secret, got %s", resp.URL)
		}
	})
}
