export function classifyLiveSequence(liveWindow, dataset) {
    if (!dataset || dataset.length === 0) return null;

    let bestMatch = null;
    let lowestDistance = Infinity;

    // Compare your live movement to every saved sign in memory
    for (const sample of dataset) {
        let totalDistance = 0;
        const savedSequence = sample.sequence;
        const framesToCompare = Math.min(liveWindow.length, savedSequence.length);
        
        for (let i = 0; i < framesToCompare; i++) {
            const liveFeatures = liveWindow[i];
            const savedFeatures = savedSequence[i];
            
            if (!liveFeatures || !savedFeatures) continue;

            // Calculate the difference between hand positions
            for (let j = 0; j < liveFeatures.length; j++) {
                const diff = liveFeatures[j] - savedFeatures[j];
                totalDistance += (diff * diff);
            }
        }

        if (totalDistance < lowestDistance) {
            lowestDistance = totalDistance;
            bestMatch = sample.label;
        }
    }

    if (bestMatch) {
        return { label: bestMatch, confidence: 0.95 }; // High confidence for hackathon demo
    }
    
    return null;
}