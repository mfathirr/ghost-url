package storage

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/ghost-url/backend/internal/config"
	"github.com/ghost-url/backend/internal/models"
	"github.com/redis/go-redis/v9"
)

// RedisLinkStore implements LinkStore backed by a Redis connection pool.
type RedisLinkStore struct {
	client *redis.Client
}

// NewRedisStore initializes a Redis client with configured pool and timeouts.
func NewRedisStore(cfg *config.Config) (*RedisLinkStore, error) {
	opts, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		// Fallback to direct address if simple host:port
		opts = &redis.Options{
			Addr: cfg.RedisURL,
		}
	}

	opts.PoolSize = cfg.PoolSize
	opts.DialTimeout = cfg.DialTimeout
	opts.ReadTimeout = cfg.ReadTimeout
	opts.WriteTimeout = cfg.WriteTimeout

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), cfg.DialTimeout)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis at %s: %w", cfg.RedisURL, err)
	}

	return &RedisLinkStore{client: client}, nil
}

// linkKey constructs the colon-separated Redis key for a slug.
func linkKey(slug string) string {
	return "link:" + slug
}

// statusKey constructs the colon-separated Redis key for a delivery status receipt.
func statusKey(slug string) string {
	return "status:" + slug
}

// SaveLink stores the link in a Redis Hash and assigns an explicit TTL.
func (r *RedisLinkStore) SaveLink(ctx context.Context, slug string, link *models.StoredLink, ttl time.Duration, checkCollision bool) error {
	key := linkKey(slug)

	if checkCollision {
		exists, err := r.client.Exists(ctx, key).Result()
		if err != nil {
			return fmt.Errorf("check slug existence: %w", err)
		}
		if exists > 0 {
			return ErrSlugCollision
		}
	}

	pipe := r.client.TxPipeline()
	pipe.HSet(ctx, key, map[string]interface{}{
		"url":           link.URL,
		"passcode_hash": link.PasscodeHash,
		"duress_hash":   link.DuressHash,
		"created_at":    link.CreatedAt.Format(time.RFC3339),
		"expires_at":    link.ExpiresAt.Format(time.RFC3339),
		"max_views":     link.MaxViews,
		"view_count":    link.ViewCount,
	})
	pipe.Expire(ctx, key, ttl)

	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("save link to redis: %w", err)
	}

	return nil
}

// GetLink fetches the link data and remaining TTL in a single pipelined round trip.
func (r *RedisLinkStore) GetLink(ctx context.Context, slug string) (*models.StoredLink, time.Duration, error) {
	key := linkKey(slug)

	pipe := r.client.Pipeline()
	hgetCmd := pipe.HGetAll(ctx, key)
	ttlCmd := pipe.TTL(ctx, key)

	if _, err := pipe.Exec(ctx); err != nil {
		return nil, 0, fmt.Errorf("fetch link pipeline: %w", err)
	}

	fields, err := hgetCmd.Result()
	if err != nil {
		return nil, 0, fmt.Errorf("read link fields: %w", err)
	}

	// Key does not exist or has expired
	if len(fields) == 0 {
		return nil, 0, ErrLinkNotFound
	}

	ttl, err := ttlCmd.Result()
	if err != nil || ttl <= 0 {
		return nil, 0, ErrLinkNotFound
	}

	createdAt, _ := time.Parse(time.RFC3339, fields["created_at"])
	expiresAt, _ := time.Parse(time.RFC3339, fields["expires_at"])
	maxViews, _ := strconv.Atoi(fields["max_views"])
	viewCount, _ := strconv.Atoi(fields["view_count"])

	link := &models.StoredLink{
		URL:          fields["url"],
		PasscodeHash: fields["passcode_hash"],
		DuressHash:   fields["duress_hash"],
		CreatedAt:    createdAt,
		ExpiresAt:    expiresAt,
		MaxViews:     maxViews,
		ViewCount:    viewCount,
	}

	return link, ttl, nil
}

// IncrementAndCheckViews increments the view count for a link.
// If maxViews > 0 and count reaches or exceeds maxViews, the link is deleted and burned is true.
func (r *RedisLinkStore) IncrementAndCheckViews(ctx context.Context, slug string, maxViews int) (int, bool, error) {
	if maxViews <= 0 {
		return -1, false, nil
	}

	key := linkKey(slug)
	count, err := r.client.HIncrBy(ctx, key, "view_count", 1).Result()
	if err != nil {
		return 0, false, fmt.Errorf("increment view count: %w", err)
	}

	if count >= int64(maxViews) {
		_ = r.client.Del(ctx, key).Err()
		return 0, true, nil
	}

	remaining := maxViews - int(count)
	return remaining, false, nil
}

// DeleteLink immediately and permanently purges a link from storage.
func (r *RedisLinkStore) DeleteLink(ctx context.Context, slug string) error {
	key := linkKey(slug)
	return r.client.Del(ctx, key).Err()
}

// SaveDeliveryStatus records the initial pending delivery receipt for a link.
func (r *RedisLinkStore) SaveDeliveryStatus(ctx context.Context, slug string, tokenHash string, ttl time.Duration) error {
	key := statusKey(slug)
	now := time.Now().UTC()
	expiresAt := now.Add(ttl)

	pipe := r.client.TxPipeline()
	pipe.HSet(ctx, key, map[string]interface{}{
		"token_hash": tokenHash,
		"status":     "pending",
		"created_at": now.Format(time.RFC3339),
		"expires_at": expiresAt.Format(time.RFC3339),
		"viewed_at":  "",
		"burned_at":  "",
	})
	// Keep status key for link TTL plus a 24-hour audit retention window
	pipe.Expire(ctx, key, ttl+24*time.Hour)

	if _, err := pipe.Exec(ctx); err != nil {
		return fmt.Errorf("save delivery status: %w", err)
	}
	return nil
}

// UpdateDeliveryStatus records view or burn events for a delivery receipt.
func (r *RedisLinkStore) UpdateDeliveryStatus(ctx context.Context, slug string, status string, isBurned bool) error {
	key := statusKey(slug)
	nowStr := time.Now().UTC().Format(time.RFC3339)

	fields := map[string]interface{}{
		"status": status,
	}
	if status == "viewed" || status == "burned" {
		fields["viewed_at"] = nowStr
	}
	if isBurned {
		fields["status"] = "burned"
		fields["burned_at"] = nowStr
	}

	return r.client.HSet(ctx, key, fields).Err()
}

// GetDeliveryStatus retrieves the status receipt and token hash for audit verification.
func (r *RedisLinkStore) GetDeliveryStatus(ctx context.Context, slug string) (*models.StatusReceipt, string, error) {
	key := statusKey(slug)
	fields, err := r.client.HGetAll(ctx, key).Result()
	if err != nil {
		return nil, "", fmt.Errorf("read delivery status: %w", err)
	}
	if len(fields) == 0 {
		return nil, "", ErrLinkNotFound
	}

	createdAt, _ := time.Parse(time.RFC3339, fields["created_at"])
	expiresAt, _ := time.Parse(time.RFC3339, fields["expires_at"])

	var viewedAt *time.Time
	if val, ok := fields["viewed_at"]; ok && val != "" {
		if t, err := time.Parse(time.RFC3339, val); err == nil {
			viewedAt = &t
		}
	}

	var burnedAt *time.Time
	if val, ok := fields["burned_at"]; ok && val != "" {
		if t, err := time.Parse(time.RFC3339, val); err == nil {
			burnedAt = &t
		}
	}

	receipt := &models.StatusReceipt{
		Slug:      slug,
		Status:    fields["status"],
		CreatedAt: createdAt,
		ExpiresAt: expiresAt,
		ViewedAt:  viewedAt,
		BurnedAt:  burnedAt,
	}

	return receipt, fields["token_hash"], nil
}

// Exists checks if a slug exists and is active.
func (r *RedisLinkStore) Exists(ctx context.Context, slug string) (bool, error) {
	key := linkKey(slug)
	count, err := r.client.Exists(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("check existence: %w", err)
	}
	return count > 0, nil
}

// Ping checks Redis health.
func (r *RedisLinkStore) Ping(ctx context.Context) error {
	return r.client.Ping(ctx).Err()
}

// Close closes the Redis client connection pool.
func (r *RedisLinkStore) Close() error {
	return r.client.Close()
}
