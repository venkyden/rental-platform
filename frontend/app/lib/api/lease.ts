export const leaseApi = {
    get: async (id: string) => {
        // Mock implementation to satisfy build
        return {
            id,
            property_location: {
                lat: 48.8566,
                lng: 2.3522
            }
        };
    }
};
