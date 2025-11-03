import { useState, useEffect } from "react";
import { useSearch } from "../hooks/search/useSearch";
import { Box, Button, CircularProgress } from "@mui/material";
import Gallery from "../components/Gallery";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { usePostsByTag } from "../hooks/posts/usePosts";

const SearchResults = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const query = new URLSearchParams(location.search).get("q") || "";
	const queryClient = useQueryClient();
	const searchTerms = query
		.split(",")
		.map((term) => term.trim())
		.filter((term) => term.length > 0);
	const [activeTab, setActiveTab] = useState<"users" | "posts" | "tags">("posts");

	const { data, isFetching } = useSearch(query);

	useEffect(() => {
		if (query) {
			queryClient.invalidateQueries({
				queryKey: ["query", query],
				exact: false,
			});
		}
	}, [query, queryClient, location.search]);

	const { fetchNextPage, hasNextPage, isFetchingNextPage } = usePostsByTag(searchTerms, {
		// Only run if searchTerms has items AND search results exist
		enabled: searchTerms.length > 0 && !!data?.data.tags,
	});

	const handleTagClick = (tagName: string) => {
		navigate(`/results?q=${encodeURIComponent(tagName)}`);
	};

	return (
		<Box sx={{ maxWidth: "800px", margin: "auto", p: 3 }}>
			{/* Tabs */}
			<Box sx={{ display: "flex", gap: 2, mb: 3 }}>
				{(["posts", "users", "tags"] as const).map((tab) => (
					<Button key={tab} variant={activeTab === tab ? "contained" : "outlined"} onClick={() => setActiveTab(tab)}>
						{tab.charAt(0).toUpperCase() + tab.slice(1)}
					</Button>
				))}
			</Box>
			{isFetching ? (
				<CircularProgress />
			) : (
				<>
					{/* Posts Tab */}
					{activeTab === "posts" &&
						(data?.data.posts === null ? (
							<p>No posts found for {query}.</p>
						) : (
							<Gallery
								posts={data?.data.posts || []}
								fetchNextPage={fetchNextPage}
								isFetchingNext={isFetchingNextPage}
								hasNextPage={hasNextPage}
							/>
						))}
					{/* Users tab */}
					{activeTab === "users" &&
						(data?.data.users === null ? (
							<p>No users found {query}.</p>
						) : (
							data?.data.users?.map((user) => (
								<Box key={user.publicId} sx={{ p: 2, borderBottom: "1px solid #ccc" }}>
									<Link to={`/profile/${user.publicId}`} className="text-cyan-200">
										{user.username}
									</Link>
								</Box>
							))
						))}

					{/* Tags Tab */}
					{activeTab === "tags" &&
						(data?.data.tags === null ? (
							<p>No tags found for {query}.</p>
						) : (
							<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
								{data?.data.tags?.map((tag) => (
									<Box
										key={tag.id}
										sx={{
											p: 2,
											borderBottom: "1px solid #ccc",
											cursor: "pointer",
											"&:hover": {
												backgroundColor: "rgba(99, 102, 241, 0.1)",
											},
										}}
										onClick={() => handleTagClick(tag.tag)}
									>
										<p className="text-cyan-400 hover:text-cyan-300">
											#{tag.tag} ({tag.count} posts)
										</p>
									</Box>
								))}
							</Box>
						))}
				</>
			)}
		</Box>
	);
};

export default SearchResults;
