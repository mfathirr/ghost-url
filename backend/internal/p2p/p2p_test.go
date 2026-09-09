package p2p

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExtractClientIP(t *testing.T) {
	tests := []struct {
		name     string
		headers  map[string]string
		remote   string
		expected string
	}{
		{
			name: "CF-Connecting-IP takes highest priority",
			headers: map[string]string{
				"CF-Connecting-IP": "103.21.244.2",
				"X-Forwarded-For":  "192.168.1.1, 10.0.0.1",
				"X-Real-IP":        "172.16.0.5",
			},
			remote:   "127.0.0.1:54321",
			expected: "103.21.244.2",
		},
		{
			name: "X-Forwarded-For first IP",
			headers: map[string]string{
				"X-Forwarded-For": "203.0.113.195, 70.41.3.18, 150.172.238.178",
				"X-Real-IP":       "172.16.0.5",
			},
			remote:   "127.0.0.1:54321",
			expected: "203.0.113.195",
		},
		{
			name: "X-Real-IP fallback",
			headers: map[string]string{
				"X-Real-IP": "198.51.100.4",
			},
			remote:   "127.0.0.1:54321",
			expected: "198.51.100.4",
		},
		{
			name:     "RemoteAddr fallback stripping port",
			headers:  map[string]string{},
			remote:   "192.0.2.1:61234",
			expected: "192.0.2.1",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/ws/p2p", nil)
			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}
			req.RemoteAddr = tc.remote

			ip := ExtractClientIP(req)
			if ip != tc.expected {
				t.Errorf("expected %s, got %s", tc.expected, ip)
			}
		})
	}
}

func TestParseUserAgent(t *testing.T) {
	tests := []struct {
		name       string
		ua         string
		expectedOS string
		expectedDev string
	}{
		{
			name:       "Mac Safari",
			ua:         "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
			expectedOS: "macOS",
			expectedDev: "Desktop",
		},
		{
			name:       "iPhone Safari",
			ua:         "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
			expectedOS: "iOS",
			expectedDev: "Mobile",
		},
		{
			name:       "iPad Safari",
			ua:         "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
			expectedOS: "iOS",
			expectedDev: "Tablet",
		},
		{
			name:       "Windows Chrome",
			ua:         "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			expectedOS: "Windows",
			expectedDev: "Desktop",
		},
		{
			name:       "Android Mobile",
			ua:         "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36",
			expectedOS: "Android",
			expectedDev: "Mobile",
		},
		{
			name:       "Android Tablet",
			ua:         "Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			expectedOS: "Android",
			expectedDev: "Tablet",
		},
		{
			name:       "Linux Desktop",
			ua:         "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/119.0",
			expectedOS: "Linux",
			expectedDev: "Desktop",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			osName, devType := ParseUserAgent(tc.ua)
			if osName != tc.expectedOS {
				t.Errorf("OS: expected %s, got %s", tc.expectedOS, osName)
			}
			if devType != tc.expectedDev {
				t.Errorf("DeviceType: expected %s, got %s", tc.expectedDev, devType)
			}
		})
	}
}

func TestGenerateRandomName(t *testing.T) {
	name1 := GenerateRandomName()
	name2 := GenerateRandomName()

	if name1 == "" || name2 == "" {
		t.Fatalf("expected non-empty random name")
	}
}
