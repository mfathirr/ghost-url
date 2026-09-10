package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
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
	mu       sync.RWMutex
	links    map[string]*models.StoredLink
	ttls     map[string]time.Duration
	receipts map[string]*models.StatusReceipt
	tokens   map[string]string
}

func newMockStore() *mockStore {
	return &mockStore{
		links:    make(map[string]*models.StoredLink),
		ttls:     make(map[string]time.Duration),
		receipts: make(map[string]*models.StatusReceipt),
		tokens:   make(map[string]string),
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

func (m *mockStore) IncrementAndCheckViews(_ context.Context, slug string, maxViews int) (int, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	link, exists := m.links[slug]
	if !exists {
		return 0, false, storage.ErrLinkNotFound
	}

	if maxViews <= 0 {
		return -1, false, nil
	}

	link.ViewCount++
	if link.ViewCount >= maxViews {
		delete(m.links, slug)
		delete(m.ttls, slug)
		return 0, true, nil
	}

	remaining := maxViews - link.ViewCount
	return remaining, false, nil
}

func (m *mockStore) DeleteLink(_ context.Context, slug string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.links, slug)
	delete(m.ttls, slug)
	return nil
}

func (m *mockStore) SaveDeliveryStatus(_ context.Context, slug string, tokenHash string, ttl time.Duration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := time.Now().UTC()
	m.tokens[slug] = tokenHash
	m.receipts[slug] = &models.StatusReceipt{
		Slug:      slug,
		Status:    "pending",
		CreatedAt: now,
		ExpiresAt: now.Add(ttl),
	}
	return nil
}

func (m *mockStore) UpdateDeliveryStatus(_ context.Context, slug string, status string, isBurned bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	receipt, exists := m.receipts[slug]
	if !exists {
		return nil
	}
	now := time.Now().UTC()
	receipt.Status = status
	if receipt.ViewedAt == nil {
		receipt.ViewedAt = &now
	}
	if isBurned {
		receipt.Status = "burned"
		receipt.BurnedAt = &now
	}
	return nil
}

func (m *mockStore) GetDeliveryStatus(_ context.Context, slug string) (*models.StatusReceipt, string, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	receipt, exists := m.receipts[slug]
	tokenHash := m.tokens[slug]
	if !exists {
		return nil, "", storage.ErrLinkNotFound
	}
	return receipt, tokenHash, nil
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
		api.GET("/status/:slug", handler.GetDeliveryStatus)
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

func TestBurnOnReadAndMetadata(t *testing.T) {
	store := newMockStore()
	router := setupTestRouter(store)
	now := time.Now()

	// 1-view burn-on-read link
	err := store.SaveLink(context.Background(), "burn-1", &models.StoredLink{
		URL:       "https://burn.example.com",
		CreatedAt: now,
		ExpiresAt: now.Add(time.Hour),
		MaxViews:  1,
		ViewCount: 0,
	}, time.Hour, false)
	if err != nil {
		t.Fatalf("failed to save link: %v", err)
	}

	t.Run("metadata reports views_remaining = 1 before unlock", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/api/links/burn-1", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var meta models.LinkMetadataResponse
		if err := json.Unmarshal(w.Body.Bytes(), &meta); err != nil {
			t.Fatalf("decode meta: %v", err)
		}
		if meta.ViewsRemaining == nil || *meta.ViewsRemaining != 1 {
			t.Errorf("expected views_remaining 1, got %v", meta.ViewsRemaining)
		}
	})

	t.Run("first unlock succeeds and burns link", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"passcode": ""})
		req, _ := http.NewRequest(http.MethodPost, "/api/links/burn-1/unlock", bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", w.Code)
		}
		var resp models.UnlockResponse
		if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
			t.Fatalf("decode resp: %v", err)
		}
		if resp.URL != "https://burn.example.com" {
			t.Errorf("expected destination URL, got %s", resp.URL)
		}
		if !resp.Burned {
			t.Errorf("expected burned = true on 1-view link, got %v", resp.Burned)
		}
	})

	t.Run("subsequent access returns 404", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, "/api/links/burn-1", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("expected 404 after burn, got %d", w.Code)
		}
	})
}

func TestAntiCrawlerBotDefense(t *testing.T) {
	store := newMockStore()
	router := setupTestRouter(store)

	// Create a single-view burn link
	link := &models.StoredLink{
		URL:       "https://secret.example.com",
		CreatedAt: time.Now().UTC(),
		ExpiresAt: time.Now().UTC().Add(1 * time.Hour),
		MaxViews:  1,
		ViewCount: 0,
	}
	_ = store.SaveLink(context.Background(), "bot-shield", link, 1*time.Hour, false)

	botUserAgents := []string{
		"Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
		"Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
		"WhatsApp/2.21.12.21 A",
		"Twitterbot/1.0",
		"facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
		"TelegramBot (like TwitterBot)",
	}

	for _, ua := range botUserAgents {
		t.Run("bot_"+ua[:10], func(t *testing.T) {
			req, _ := http.NewRequest(http.MethodGet, "/r/bot-shield", nil)
			req.Header.Set("User-Agent", ua)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Fatalf("expected 200 OK for bot, got %d", w.Code)
			}
			body := w.Body.String()
			if !strings.Contains(body, "og:title") {
				t.Errorf("expected og:title metadata in bot response, got %s", body)
			}

			// Invariant: Link must NOT be burned or modified by bot crawl
			stored, _, err := store.GetLink(context.Background(), "bot-shield")
			if err != nil {
				t.Fatalf("expected link to still exist, got err: %v", err)
			}
			if stored.ViewCount != 0 {
				t.Errorf("expected view count to remain 0, got %d", stored.ViewCount)
			}
		})
	}
}

func TestDuressPasscode(t *testing.T) {
	store := newMockStore()
	router := setupTestRouter(store)

	createPayload := models.CreateLinkRequest{
		URL:            "https://critical-vault.example.com",
		Passcode:       "safe-pass-123",
		DuressPasscode: "poison-pill-999",
		ExpiresIn:      "1h",
		MaxViews:       1,
	}
	body, _ := json.Marshal(createPayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/links", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d", w.Code)
	}
	var created models.CreateLinkResponse
	_ = json.Unmarshal(w.Body.Bytes(), &created)

	// Trigger duress unlock with poison pill passcode
	unlockBody, _ := json.Marshal(models.UnlockRequest{Passcode: "poison-pill-999"})
	unlockReq, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/links/%s/unlock", created.Slug), bytes.NewBuffer(unlockBody))
	unlockReq.Header.Set("Content-Type", "application/json")
	unlockRec := httptest.NewRecorder()
	router.ServeHTTP(unlockRec, unlockReq)

	// Must return 404 for plausible deniability
	if unlockRec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 Not Found on duress, got %d", unlockRec.Code)
	}

	// Invariant: Link must be completely purged from storage
	_, _, err := store.GetLink(context.Background(), created.Slug)
	if !errors.Is(err, storage.ErrLinkNotFound) {
		t.Fatalf("expected link to be deleted, got err: %v", err)
	}
}

func TestDeliveryStatusReceipt(t *testing.T) {
	store := newMockStore()
	router := setupTestRouter(store)

	createPayload := models.CreateLinkRequest{
		URL:       "https://receipt-test.example.com",
		ExpiresIn: "1h",
		MaxViews:  1,
	}
	body, _ := json.Marshal(createPayload)
	req, _ := http.NewRequest(http.MethodPost, "/api/links", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d", w.Code)
	}
	var created models.CreateLinkResponse
	_ = json.Unmarshal(w.Body.Bytes(), &created)

	if created.StatusToken == "" {
		t.Fatal("expected status_token in creation response")
	}

	// 1. Fetch delivery status while pending
	statusReq, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/status/%s?token=%s", created.Slug, created.StatusToken), nil)
	statusRec := httptest.NewRecorder()
	router.ServeHTTP(statusRec, statusReq)

	if statusRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for status, got %d", statusRec.Code)
	}
	var receipt models.StatusReceipt
	_ = json.Unmarshal(statusRec.Body.Bytes(), &receipt)
	if receipt.Status != "pending" {
		t.Errorf("expected status 'pending', got %s", receipt.Status)
	}

	// 2. Fetch with wrong token returns 401
	wrongReq, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/status/%s?token=invalid_token", created.Slug), nil)
	wrongRec := httptest.NewRecorder()
	router.ServeHTTP(wrongRec, wrongReq)
	if wrongRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized for invalid token, got %d", wrongRec.Code)
	}

	// 3. Unlock link (burns it)
	unlockBody, _ := json.Marshal(models.UnlockRequest{Passcode: ""})
	unlockReq, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("/api/links/%s/unlock", created.Slug), bytes.NewBuffer(unlockBody))
	unlockReq.Header.Set("Content-Type", "application/json")
	unlockRec := httptest.NewRecorder()
	router.ServeHTTP(unlockRec, unlockReq)

	if unlockRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on unlock, got %d", unlockRec.Code)
	}

	// 4. Verify delivery status updated to 'burned'
	statusReq2, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/status/%s?token=%s", created.Slug, created.StatusToken), nil)
	statusRec2 := httptest.NewRecorder()
	router.ServeHTTP(statusRec2, statusReq2)

	var receipt2 models.StatusReceipt
	_ = json.Unmarshal(statusRec2.Body.Bytes(), &receipt2)
	if receipt2.Status != "burned" {
		t.Errorf("expected status 'burned', got %s", receipt2.Status)
	}
	if receipt2.BurnedAt == nil {
		t.Error("expected burned_at timestamp to be populated")
	}
}

