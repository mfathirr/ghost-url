package storage

import (
	"context"
	"errors"
	"time"

	"github.com/ghost-url/backend/internal/models"
)

var (
	// ErrLinkNotFound is returned when a requested link does not exist or has expired.
	ErrLinkNotFound = errors.New("link not found or expired")
	// ErrSlugCollision is returned when a custom alias is already active.
	ErrSlugCollision = errors.New("alias already in use")
)

// LinkStore defines the storage contract for persisting and retrieving ephemeral links.
type LinkStore interface {
	// SaveLink stores a link under the given slug with an explicit TTL.
	// If checkCollision is true and the slug exists, ErrSlugCollision is returned.
	SaveLink(ctx context.Context, slug string, link *models.StoredLink, ttl time.Duration, checkCollision bool) error

	// GetLink retrieves the stored link and its remaining TTL. Returns ErrLinkNotFound if absent or expired.
	GetLink(ctx context.Context, slug string) (*models.StoredLink, time.Duration, error)

	// Exists checks if a slug is currently active in storage.
	Exists(ctx context.Context, slug string) (bool, error)

	// IncrementAndCheckViews increments the view count for a link.
	// If maxViews > 0 and the count reaches or exceeds maxViews, the link is deleted and burned is true.
	// Returns remaining views (-1 if unlimited), whether it was burned, and error.
	IncrementAndCheckViews(ctx context.Context, slug string, maxViews int) (viewsRemaining int, burned bool, err error)

	// DeleteLink immediately and permanently purges a link from storage.
	DeleteLink(ctx context.Context, slug string) error

	// SaveDeliveryStatus records the initial pending delivery receipt for a link.
	SaveDeliveryStatus(ctx context.Context, slug string, tokenHash string, ttl time.Duration) error

	// UpdateDeliveryStatus records view or burn events for a delivery receipt.
	UpdateDeliveryStatus(ctx context.Context, slug string, status string, isBurned bool) error

	// GetDeliveryStatus retrieves the status receipt and token hash for audit verification.
	GetDeliveryStatus(ctx context.Context, slug string) (*models.StatusReceipt, string, error)

	// Ping checks health of the storage connection.
	Ping(ctx context.Context) error

	// Close terminates the storage connection pool.
	Close() error
}
