import { useState, useEffect, useMemo } from "react";
import { useSearch } from "../hooks/search/useSearch";
import { usePostsByTag } from "../hooks/posts/usePosts";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import Gallery from "../components/Gallery";
import { Link, useLocation } from "react-router-dom";

const SearchResults = () => {
	const location = useLocation();

	// Parse the search query
	const rawQuery = new URLSearchParams(location.search).get("q") || "";

	// prevent unnecessary re-renders
	const searchTerms = useMemo(
		() =>
			rawQuery
				.split(",")
				.map((t) => t.trim())
				.filter((t) => t.length > 0),
		[rawQuery]
	);

	const [activeTab, setActiveTab] = useState<"posts" | "users">("posts");

	const { data: searchData, isFetching: isSearchingUsers } = useSearch(rawQuery);

	// Fetch Posts with infinite scroll
	const {
		data: postsData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading: isLoadingPosts,
	} = usePostsByTag(searchTerms, {
		enabled: searchTerms.length > 0,
	});

	// Flatten pages
	const allPosts = useMemo(() => {
		return postsData?.pages.flatMap((page) => page.data) || [];
	}, [postsData]);

	useEffect(() => {
		setActiveTab("posts");
	}, [rawQuery]);

	useEffect(() => {
		if (!isLoadingPosts && !isSearchingUsers && activeTab === "posts") {
			const hasPosts = allPosts.length > 0;
			const hasUsers = searchData?.data.users && searchData.data.users.length > 0;

			if (!hasPosts && hasUsers) {
				setActiveTab("users");
			}
		}
	}, [isLoadingPosts, isSearchingUsers, allPosts.length, searchData, activeTab]);

	const isLoading = isLoadingPosts || isSearchingUsers;

	return (
		<Box sx={{ maxWidth: "800px", mx: "auto", p: 3 }}>
			{/* Tab Buttons */}
			<Box sx={{ display: "flex", gap: 2, mb: 3 }}>
				<Button variant={activeTab === "posts" ? "contained" : "outlined"} onClick={() => setActiveTab("posts")}>
					Posts ({allPosts.length})
				</Button>
				<Button variant={activeTab === "users" ? "contained" : "outlined"} onClick={() => setActiveTab("users")}>
					Users ({searchData?.data.users?.length || 0})
				</Button>
			</Box>

			{isLoading && allPosts.length === 0 ? (
				<Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
					<CircularProgress />
				</Box>
			) : (
				<>
					{/* Posts tab */}
					{activeTab === "posts" && (
						<Box>
							{allPosts.length > 0 ? (
								<Gallery
									posts={allPosts}
									fetchNextPage={fetchNextPage}
									isFetchingNext={isFetchingNextPage}
									hasNextPage={!!hasNextPage}
								/>
							) : (
								<Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
									No posts found for "{rawQuery}".
								</Typography>
							)}
						</Box>
					)}

					{/* Users tab */}
					{activeTab === "users" && (
						<Box>
							{searchData?.data.users && searchData.data.users.length > 0 ? (
								searchData.data.users.map((user) => (
									<Box
										key={user.publicId}
										sx={{
											p: 2,
											borderBottom: "1px solid #eee",
											display: "flex",
											alignItems: "center",
											gap: 2,
											"&:hover": { bgcolor: "rgba(0,0,0,0.02)" },
										}}
									>
										<img
											src={user.avatar}
											alt={user.username}
											style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
										/>
										<Link
											to={`/profile/${user.publicId}`}
											style={{ textDecoration: "none", fontWeight: "bold", color: "inherit" }}
										>
											@{user.username}
										</Link>
									</Box>
								))
							) : (
								<Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
									No users found matching "{rawQuery}".
								</Typography>
							)}
						</Box>
					)}
				</>
			)}
		</Box>
	);
};

export default SearchResults;
