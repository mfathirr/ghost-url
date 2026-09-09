package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds runtime configuration loaded from environment variables.
type Config struct {
	Port         string
	RedisURL     string
	BaseURL      string
	FrontendURL  string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	DialTimeout  time.Duration
	PoolSize     int
}

// Load loads configuration from environment variables with safe defaults.
func Load() *Config {
	port := getEnv("PORT", "8080")
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379")
	baseURL := getEnv("BASE_URL", "http://localhost:8080")
	frontendURL := getEnv("FRONTEND_URL", "http://localhost:5173")

	poolSize := 10
	if val := os.Getenv("REDIS_POOL_SIZE"); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
			poolSize = parsed
		}
	}

	return &Config{
		Port:         port,
		RedisURL:     redisURL,
		BaseURL:      baseURL,
		FrontendURL:  frontendURL,
		DialTimeout:  2 * time.Second,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
		PoolSize:     poolSize,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
