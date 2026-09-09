package utils

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateRandomSlug(t *testing.T) {
	seen := make(map[string]bool)
	for i := 0; i < 100; i++ {
		slug, err := GenerateRandomSlug()
		if err != nil {
			t.Fatalf("unexpected error generating slug: %v", err)
		}
		if len(slug) != slugLength {
			t.Errorf("expected slug length %d, got %d for slug %q", slugLength, len(slug), slug)
		}
		if seen[slug] {
			t.Errorf("slug collision detected: %s", slug)
		}
		seen[slug] = true
	}
}

func TestValidateAlias(t *testing.T) {
	tests := []struct {
		name    string
		alias   string
		wantErr bool
	}{
		{"valid standard", "my-cool-link", false},
		{"valid with underscore", "cool_link_123", false},
		{"valid min length", "abc", false},
		{"too short", "ab", true},
		{"too long", strings.Repeat("a", 65), true},
		{"invalid characters spaces", "my link", true},
		{"invalid special characters", "link!@#", true},
		{"reserved alias api", "api", true},
		{"reserved alias ping", "ping", true},
		{"reserved alias uppercase", "API", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateAlias(tt.alias)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateAlias(%q) error = %v, wantErr = %v", tt.alias, err, tt.wantErr)
			}
		})
	}
}

func TestValidateURL(t *testing.T) {
	tests := []struct {
		name    string
		rawURL  string
		wantErr bool
	}{
		{"valid https", "https://example.com/some/path?query=1", false},
		{"valid http", "http://localhost:3000", false},
		{"missing scheme", "example.com", true},
		{"invalid scheme ftp", "ftp://example.com", true},
		{"empty url", "", true},
		{"invalid scheme javascript", "javascript:alert(1)", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidateURL(tt.rawURL)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateURL(%q) error = %v, wantErr = %v", tt.rawURL, err, tt.wantErr)
			}
		})
	}
}

func TestParseTTL(t *testing.T) {
	tests := []struct {
		name       string
		expiresIn  string
		ttlSeconds int64
		want       time.Duration
		wantErr    bool
	}{
		{"5m duration", "5m", 0, 5 * time.Minute, false},
		{"30m duration", "30m", 0, 30 * time.Minute, false},
		{"1h duration", "1h", 0, 1 * time.Hour, false},
		{"24h duration", "24h", 0, 24 * time.Hour, false},
		{"7d custom days", "7d", 0, 7 * 24 * time.Hour, false},
		{"custom seconds", "", 300, 5 * time.Minute, false},
		{"empty string defaults to 1h", "", 0, 1 * time.Hour, false},
		{"below min 1m", "30s", 0, 0, true},
		{"above max 7d", "8d", 0, 0, true},
		{"invalid string", "invalid", 0, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			d, err := ParseTTL(tt.expiresIn, tt.ttlSeconds)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseTTL(%q, %d) error = %v, wantErr = %v", tt.expiresIn, tt.ttlSeconds, err, tt.wantErr)
			}
			if !tt.wantErr && d != tt.want {
				t.Errorf("ParseTTL(%q, %d) = %v, want %v", tt.expiresIn, tt.ttlSeconds, d, tt.want)
			}
		})
	}
}
