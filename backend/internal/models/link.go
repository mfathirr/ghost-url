package models

import "time"

// CreateLinkRequest defines the payload for creating a new ephemeral short link.
type CreateLinkRequest struct {
	URL        string `json:"url" binding:"required"`
	Alias      string `json:"alias"`
	Passcode   string `json:"passcode"`
	ExpiresIn  string `json:"expires_in"`  // Predefined or duration string like "5m", "30m", "1h", "24h"
	TTLSeconds int64  `json:"ttl_seconds"` // Optional explicit seconds for custom durations
	MaxViews   int    `json:"max_views"`   // 0 = unlimited, or visit limit (e.g. 1, 3, 5)
}

// CreateLinkResponse defines the response after a link is created.
type CreateLinkResponse struct {
	Slug        string    `json:"slug"`
	ShortURL    string    `json:"short_url"`
	ExpiresAt   time.Time `json:"expires_at"`
	TTLSeconds  int64     `json:"ttl_seconds"`
	HasPasscode bool      `json:"has_passcode"`
	MaxViews    int       `json:"max_views,omitempty"`
}

// LinkMetadataResponse defines public metadata about a link before unlocking/redirecting.
type LinkMetadataResponse struct {
	Slug           string    `json:"slug"`
	Protected      bool      `json:"protected"`
	ExpiresAt      time.Time `json:"expires_at"`
	TTLRemaining   int64     `json:"ttl_remaining"`
	MaxViews       int       `json:"max_views,omitempty"`
	ViewsRemaining *int      `json:"views_remaining"` // nil if unlimited
}

// UnlockRequest defines the payload to unlock a passcode-protected link.
type UnlockRequest struct {
	Passcode string `json:"passcode"`
}

// UnlockResponse returns the original URL once verified.
type UnlockResponse struct {
	URL    string `json:"url"`
	Burned bool   `json:"burned,omitempty"` // true if this unlock burned the final view
}

// StoredLink represents the link entity stored in Redis Hash fields.
type StoredLink struct {
	URL          string    `json:"url"`
	PasscodeHash string    `json:"passcode_hash"`
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    time.Time `json:"expires_at"`
	MaxViews     int       `json:"max_views"`
	ViewCount    int       `json:"view_count"`
}
