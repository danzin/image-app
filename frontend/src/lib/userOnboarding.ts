import { IUser } from "../types";

/**
 * Determines if a user should see discovery feeds instead of personalized feeds
 * New users (cold-start) should be directed to discovery content first
 */
export const shouldShowDiscoveryFirst = (user: IUser | null, isLoggedIn: boolean): boolean => {
	// Non-logged-in users should see discovery
	if (!isLoggedIn || !user) {
		return true;
	}

	// Check if user is new based on various signals
	const hasNoFollowing = user.followingCount === 0;
	const hasNoFollowers = user.followerCount === 0;
	const hasNoImages = user.imageCount === 0;

	// For the time being a user is "new" if they have no social connections and no content
	// Later I can expand this to include account age and activity levels but I'm not sure how useful that would be
	// as it doesn't matter for how long you've been registered if you have no activity

	const isNewUser = hasNoFollowing && hasNoFollowers && hasNoImages;

	return isNewUser;
};

/**
 * Determines the default tab for the discovery screen
 * @param user - Current user object
 * @param isLoggedIn - Whether user is logged in
 * @returns Tab index (0 = New, 1 = Trending, 2 = For You)
 */
export const getDefaultDiscoveryTab = (user: IUser | null, isLoggedIn: boolean): number => {
	if (!isLoggedIn) {
		return 0; // New tab for anonymous users
	}

	if (shouldShowDiscoveryFirst(user, isLoggedIn)) {
		return 0; // New tab for new users
	}

	return 2; // For You tab for established users
};

/**
 * Gets the appropriate redirect path for new vs established users
 */
export const getHomeRedirectPath = (user: IUser | null, isLoggedIn: boolean): string => {
	if (shouldShowDiscoveryFirst(user, isLoggedIn)) {
		return "/discover";
	}
	return "/";
};
