package utils

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const (
	charset    = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	slugLength = 8
)

var (
	aliasRegex      = regexp.MustCompile(`^[a-zA-Z0-9_-]{3,64}$`)
	reservedAliases = map[string]bool{
		"api":       true,
		"health":    true,
		"healthz":   true,
		"ping":      true,
		"r":         true,
		"created":   true,
		"static":    true,
		"favicon":   true,
		"dashboard": true,
	}

	// ErrInvalidAlias is returned when a custom alias does not meet formatting constraints.
	ErrInvalidAlias = errors.New("alias must be 3-64 characters and contain only letters, numbers, hyphens, and underscores")
	// ErrReservedAlias is returned when an alias collides with a reserved route.
	ErrReservedAlias = errors.New("this alias is reserved for system use")
	// ErrInvalidURL is returned when the long URL is not a valid absolute HTTP/HTTPS URL.
	ErrInvalidURL = errors.New("url must be a valid absolute HTTP or HTTPS URL")
	// ErrInvalidTTL is returned when the duration is invalid, zero, or exceeds maximum allowed.
	ErrInvalidTTL = errors.New("invalid expiration time; must be between 1 minute and 7 days")
)

// GenerateSecureToken generates a cryptographically secure alphanumeric token of the specified length.
func GenerateSecureToken(length int) (string, error) {
	bytes := make([]byte, length)
	charsetLen := big.NewInt(int64(len(charset)))

	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, charsetLen)
		if err != nil {
			return "", fmt.Errorf("generate random byte: %w", err)
		}
		bytes[i] = charset[n.Int64()]
	}

	return string(bytes), nil
}

// GenerateRandomSlug generates a cryptographically secure 8-character alphanumeric string.
func GenerateRandomSlug() (string, error) {
	return GenerateSecureToken(slugLength)
}

// ValidateAlias checks whether a custom alias is valid and not reserved.
func ValidateAlias(alias string) error {
	trimmed := strings.TrimSpace(alias)
	if !aliasRegex.MatchString(trimmed) {
		return ErrInvalidAlias
	}
	if reservedAliases[strings.ToLower(trimmed)] {
		return ErrReservedAlias
	}
	return nil
}

// ValidateURL checks whether longURL is a valid absolute HTTP or HTTPS URL,
// or a client-side end-to-end encrypted payload prefixed with "enc:".
func ValidateURL(rawURL string) (string, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return "", ErrInvalidURL
	}

	// Support Zero-Knowledge E2EE encrypted ciphertext payload
	if strings.HasPrefix(trimmed, "enc:") {
		if len(trimmed) < 10 {
			return "", errors.New("encrypted payload is too short")
		}
		if len(trimmed) > 262144 { // 256 KB max for secret notes / encrypted payloads
			return "", errors.New("encrypted payload exceeds maximum size of 256KB")
		}
		return trimmed, nil
	}

	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidURL, err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "http" && scheme != "https" {
		return "", fmt.Errorf("%w: scheme must be http or https", ErrInvalidURL)
	}

	if parsed.Host == "" {
		return "", fmt.Errorf("%w: host cannot be empty", ErrInvalidURL)
	}

	return parsed.String(), nil
}

// ParseTTL parses the duration from expiresIn string or ttlSeconds int64.
// Supported predefined strings: "5m", "30m", "1h", "24h", "7d", or standard Go duration strings.
func ParseTTL(expiresIn string, ttlSeconds int64) (time.Duration, error) {
	var d time.Duration

	if ttlSeconds > 0 {
		d = time.Duration(ttlSeconds) * time.Second
	} else if strings.TrimSpace(expiresIn) != "" {
		str := strings.TrimSpace(strings.ToLower(expiresIn))
		// Support "d" suffix (e.g. 7d = 168h, 1d = 24h)
		if strings.HasSuffix(str, "d") {
			daysStr := strings.TrimSuffix(str, "d")
			var days int
			if _, err := fmt.Sscanf(daysStr, "%d", &days); err != nil || days <= 0 {
				return 0, ErrInvalidTTL
			}
			d = time.Duration(days) * 24 * time.Hour
		} else {
			parsed, err := time.ParseDuration(str)
			if err != nil {
				return 0, fmt.Errorf("%w: %v", ErrInvalidTTL, err)
			}
			d = parsed
		}
	} else {
		// Default to 1 hour if not specified
		d = 1 * time.Hour
	}

	// Enforce bounds: min 1 minute, max 7 days
	minTTL := 1 * time.Minute
	maxTTL := 7 * 24 * time.Hour
	if d < minTTL || d > maxTTL {
		return 0, ErrInvalidTTL
	}

	return d, nil
}
