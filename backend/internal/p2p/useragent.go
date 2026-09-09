package p2p

import "strings"

// ParseUserAgent extracts operating system and device category from User-Agent string.
func ParseUserAgent(ua string) (os, deviceType string) {
	lower := strings.ToLower(ua)

	// Detect Tablet
	isTablet := strings.Contains(lower, "ipad") ||
		(strings.Contains(lower, "android") && !strings.Contains(lower, "mobile")) ||
		strings.Contains(lower, "tablet") ||
		strings.Contains(lower, "playbook") ||
		strings.Contains(lower, "silk")

	// Detect Mobile
	isMobile := !isTablet && (strings.Contains(lower, "mobile") ||
		strings.Contains(lower, "iphone") ||
		strings.Contains(lower, "ipod") ||
		strings.Contains(lower, "android") ||
		strings.Contains(lower, "blackberry") ||
		strings.Contains(lower, "windows phone"))

	if isTablet {
		deviceType = "Tablet"
	} else if isMobile {
		deviceType = "Mobile"
	} else {
		deviceType = "Desktop"
	}

	// Detect OS
	switch {
	case strings.Contains(lower, "iphone") || strings.Contains(lower, "ipad") || strings.Contains(lower, "ipod"):
		os = "iOS"
	case strings.Contains(lower, "macintosh") || strings.Contains(lower, "mac os x"):
		os = "macOS"
	case strings.Contains(lower, "windows"):
		os = "Windows"
	case strings.Contains(lower, "android"):
		os = "Android"
	case strings.Contains(lower, "linux") || strings.Contains(lower, "cros") || strings.Contains(lower, "x11"):
		os = "Linux"
	default:
		os = "Unknown"
	}

	return os, deviceType
}
