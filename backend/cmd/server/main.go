package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ghost-url/backend/internal/config"
	"github.com/ghost-url/backend/internal/handlers"
	"github.com/ghost-url/backend/internal/p2p"
	"github.com/ghost-url/backend/internal/storage"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	// Initialize Redis Store with connection pool
	store, err := storage.NewRedisStore(cfg)
	if err != nil {
		log.Printf("Warning: Redis not immediately reachable at %s: %v", cfg.RedisURL, err)
		log.Println("Server starting; requests requiring Redis will retry or report error until Redis is up.")
	} else {
		defer func() {
			if closeErr := store.Close(); closeErr != nil {
				log.Printf("Error closing Redis pool: %v", closeErr)
			}
		}()
		log.Printf("Connected to Redis at %s", cfg.RedisURL)
	}

	router := gin.Default()

	// Configure CORS for local development and proxy flexibility
	corsConfig := cors.DefaultConfig()
	corsConfig.AllowAllOrigins = true
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Accept", "Authorization"}
	corsConfig.ExposeHeaders = []string{"Content-Length", "Location"}
	corsConfig.AllowCredentials = false
	corsConfig.MaxAge = 12 * time.Hour
	router.Use(cors.New(corsConfig))

	linkHandler := handlers.NewLinkHandler(store, cfg)
	p2pHub := p2p.NewHub()
	go p2pHub.Run()
	p2pHandler := p2p.NewHandler(p2pHub)

	// API Routes
	api := router.Group("/api")
	{
		api.POST("/links", linkHandler.CreateLink)
		api.GET("/links/:slug", linkHandler.GetLinkMetadata)
		api.POST("/links/:slug/unlock", linkHandler.UnlockLink)
		api.GET("/status/:slug", linkHandler.GetDeliveryStatus)
		api.GET("/ws/p2p", p2pHandler.ServeWS)
	}

	// Short redirect route
	router.GET("/r/:slug", linkHandler.RedirectLink)

	// P2P WebSocket signaling endpoint
	router.GET("/ws/p2p", p2pHandler.ServeWS)

	// Health check endpoint
	router.GET("/health", linkHandler.HealthCheck)

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in background goroutine
	go func() {
		log.Printf("Ghost URL backend listening on port %s (BaseURL: %s)", cfg.Port, cfg.BaseURL)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Server failed to listen: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shut down the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	sig := <-quit
	log.Printf("Received signal %v, shutting down server...", sig)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully.")
}
