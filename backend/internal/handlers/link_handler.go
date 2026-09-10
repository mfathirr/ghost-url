package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/ghost-url/backend/internal/config"
	"github.com/ghost-url/backend/internal/models"
	"github.com/ghost-url/backend/internal/storage"
	"github.com/ghost-url/backend/internal/utils"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// LinkHandler holds dependencies for HTTP route handling.
type LinkHandler struct {
	store storage.LinkStore
	cfg   *config.Config
}

// NewLinkHandler constructs a new LinkHandler.
func NewLinkHandler(store storage.LinkStore, cfg *config.Config) *LinkHandler {
	return &LinkHandler{
		store: store,
		cfg:   cfg,
	}
}

// CreateLink handles POST /api/links to generate a new ephemeral short link.
func (h *LinkHandler) CreateLink(c *gin.Context) {
	var req models.CreateLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload: url is required"})
		return
	}

	validURL, err := utils.ValidateURL(req.URL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.MaxViews < 0 || req.MaxViews > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "max_views must be between 0 (unlimited) and 100"})
		return
	}

	ttl, err := utils.ParseTTL(req.ExpiresIn, req.TTLSeconds)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var slug string
	var isCustomAlias bool

	trimmedAlias := strings.TrimSpace(req.Alias)
	if trimmedAlias != "" {
		if err := utils.ValidateAlias(trimmedAlias); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		slug = trimmedAlias
		isCustomAlias = true
	} else {
		// Generate random 8-character slug with collision avoidance
		for attempt := 0; attempt < 5; attempt++ {
			candidate, err := utils.GenerateRandomSlug()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate slug"})
				return
			}
			exists, err := h.store.Exists(c.Request.Context(), candidate)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error checking slug"})
				return
			}
			if !exists {
				slug = candidate
				break
			}
		}
		if slug == "" {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to allocate unique slug, please try again"})
			return
		}
	}

	var passcodeHash string
	trimmedPasscode := strings.TrimSpace(req.Passcode)
	if trimmedPasscode != "" {
		if len(trimmedPasscode) < 3 || len(trimmedPasscode) > 72 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Passcode must be between 3 and 72 characters"})
			return
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(trimmedPasscode), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to secure passcode"})
			return
		}
		passcodeHash = string(hashed)
	}

	now := time.Now().UTC()
	expiresAt := now.Add(ttl)

	stored := &models.StoredLink{
		URL:          validURL,
		PasscodeHash: passcodeHash,
		CreatedAt:    now,
		ExpiresAt:    expiresAt,
		MaxViews:     req.MaxViews,
		ViewCount:    0,
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.cfg.WriteTimeout)
	defer cancel()

	if err := h.store.SaveLink(ctx, slug, stored, ttl, isCustomAlias); err != nil {
		if errors.Is(err, storage.ErrSlugCollision) {
			c.JSON(http.StatusConflict, gin.H{"error": "Custom alias is already in use"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store link"})
		return
	}

	shortURL := fmt.Sprintf("%s/r/%s", strings.TrimRight(h.cfg.BaseURL, "/"), slug)

	c.JSON(http.StatusCreated, models.CreateLinkResponse{
		Slug:        slug,
		ShortURL:    shortURL,
		ExpiresAt:   expiresAt,
		TTLSeconds:  int64(ttl.Seconds()),
		HasPasscode: passcodeHash != "",
		MaxViews:    req.MaxViews,
	})
}

// GetLinkMetadata handles GET /api/links/:slug to check protection status and expiry.
func (h *LinkHandler) GetLinkMetadata(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Slug parameter required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.cfg.ReadTimeout)
	defer cancel()

	link, ttl, err := h.store.GetLink(ctx, slug)
	if err != nil {
		if errors.Is(err, storage.ErrLinkNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Link not found or expired"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error retrieving link"})
		return
	}

	resp := models.LinkMetadataResponse{
		Slug:         slug,
		Protected:    link.PasscodeHash != "",
		ExpiresAt:    link.ExpiresAt,
		TTLRemaining: int64(ttl.Seconds()),
		MaxViews:     link.MaxViews,
	}
	if link.MaxViews > 0 {
		remaining := link.MaxViews - link.ViewCount
		if remaining < 0 {
			remaining = 0
		}
		resp.ViewsRemaining = &remaining
	}

	c.JSON(http.StatusOK, resp)
}

// UnlockLink handles POST /api/links/:slug/unlock to verify passcode and obtain the destination URL.
// It also atomically increments view count and burns the link if the view limit is reached.
func (h *LinkHandler) UnlockLink(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Slug parameter required"})
		return
	}

	var req models.UnlockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Passcode is required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.cfg.ReadTimeout)
	defer cancel()

	link, _, err := h.store.GetLink(ctx, slug)
	if err != nil {
		if errors.Is(err, storage.ErrLinkNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Link not found or expired"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error retrieving link"})
		return
	}

	// If passcode is set, verify passcode hash before burning any view
	if link.PasscodeHash != "" {
		if err := bcrypt.CompareHashAndPassword([]byte(link.PasscodeHash), []byte(req.Passcode)); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect passcode"})
			return
		}
	}

	// Consume view: atomically increment view counter and burn if limit reached
	_, burned, err := h.store.IncrementAndCheckViews(ctx, slug, link.MaxViews)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error updating views"})
		return
	}

	c.JSON(http.StatusOK, models.UnlockResponse{
		URL:    link.URL,
		Burned: burned,
	})
}

// RedirectLink handles GET /r/:slug for direct link traversal.
// Unprotected plain links issue an immediate HTTP 302 Found redirect.
// Passcode-protected, burn-on-read, or client-encrypted links redirect to the frontend view.
func (h *LinkHandler) RedirectLink(c *gin.Context) {
	slug := c.Param("slug")
	if slug == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Slug parameter required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), h.cfg.ReadTimeout)
	defer cancel()

	link, _, err := h.store.GetLink(ctx, slug)
	if err != nil {
		if errors.Is(err, storage.ErrLinkNotFound) {
			// If browser requested HTML, redirect to frontend 404 page
			accept := c.GetHeader("Accept")
			if strings.Contains(accept, "text/html") && h.cfg.FrontendURL != "" {
				c.Redirect(http.StatusFound, fmt.Sprintf("%s/r/%s", strings.TrimRight(h.cfg.FrontendURL, "/"), slug))
				return
			}
			c.JSON(http.StatusNotFound, gin.H{"error": "Link not found or expired"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error retrieving link"})
		return
	}

	// If passcode protected, has view limits, or is not a plain HTTP/HTTPS URL:
	// route to frontend unlock view or return JSON if requested by API
	isStandardURL := strings.HasPrefix(link.URL, "http://") || strings.HasPrefix(link.URL, "https://")
	if link.PasscodeHash != "" || link.MaxViews > 0 || !isStandardURL {
		accept := c.GetHeader("Accept")
		if strings.Contains(accept, "application/json") && !strings.Contains(accept, "text/html") {
			c.JSON(http.StatusOK, gin.H{
				"protected": link.PasscodeHash != "",
				"max_views": link.MaxViews,
				"slug":      slug,
			})
			return
		}

		// Direct browser visit: redirect to frontend unlock form
		target := fmt.Sprintf("%s/r/%s", strings.TrimRight(h.cfg.FrontendURL, "/"), slug)
		c.Redirect(http.StatusFound, target)
		return
	}

	// No passcode and no view limit: Immediate 302 redirect
	c.Redirect(http.StatusFound, link.URL)
}

// HealthCheck handles GET /health for container readiness probes.
func (h *LinkHandler) HealthCheck(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
	defer cancel()

	if err := h.store.Ping(ctx); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status": "degraded",
			"redis":  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}
