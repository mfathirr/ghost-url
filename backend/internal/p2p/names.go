package p2p

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

var adjectives = []string{
	"Neon", "Swift", "Cosmic", "Solar", "Lunar",
	"Shadow", "Crystal", "Electric", "Velvet", "Silent",
	"Golden", "Emerald", "Mystic", "Thunder", "Frosty",
	"Blazing", "Aqua", "Radiant", "Silver", "Crimson",
	"Obsidian", "Hyper", "Vortex", "Zenith", "Cobalt",
}

var animals = []string{
	"Falcon", "Otter", "Lynx", "Fox", "Panther",
	"Eagle", "Wolf", "Dolphin", "Hawk", "Badger",
	"Jaguar", "Phoenix", "Cheetah", "Tiger", "Raven",
	"Osprey", "Condor", "Viper", "Dragon", "Puma",
	"Bear", "Leopard", "Shark", "Bison", "Orka",
}

// GenerateRandomName generates a friendly two-word moniker like "Neon Falcon".
func GenerateRandomName() string {
	adjLen := big.NewInt(int64(len(adjectives)))
	animLen := big.NewInt(int64(len(animals)))

	adjIdx, err := rand.Int(rand.Reader, adjLen)
	if err != nil {
		return "Ghost Peer"
	}
	animIdx, err := rand.Int(rand.Reader, animLen)
	if err != nil {
		return "Ghost Peer"
	}

	return fmt.Sprintf("%s %s", adjectives[adjIdx.Int64()], animals[animIdx.Int64()])
}
