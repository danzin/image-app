import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
	Avatar,
	Badge,
	Box,
	Button,
	CircularProgress,
	Divider,
	IconButton,
	InputAdornment,
	List,
	ListItem,
	ListItemAvatar,
	ListItemButton,
	ListItemText,
	Paper,
	TextField,
	Typography,
	useMediaQuery,
	useTheme,
} from "@mui/material";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import { useConversations } from "../hooks/messaging/useConversations";
import { useConversationMessages } from "../hooks/messaging/useConversationMessages";
import { useSendMessage } from "../hooks/messaging/useSendMessage";
import { useMarkConversationRead } from "../hooks/messaging/useMarkConversationRead";
import { useAuth } from "../hooks/context/useAuth";
import { ConversationSummaryDTO, MessageDTO } from "../types";

const CONVERSATION_PANEL_WIDTH = 320;

const formatTimestamp = (timestamp: string) => {
	try {
		const date = new Date(timestamp);
		return new Intl.DateTimeFormat("en", {
			hour: "numeric",
			minute: "numeric",
			month: "short",
			day: "numeric",
		}).format(date);
	} catch {
		return timestamp;
	}
};

const getConversationTitle = (conversation: ConversationSummaryDTO, currentUserId?: string | null) => {
	if (conversation.title) {
		return conversation.title;
	}

	const others = conversation.participants.filter((participant) => participant.publicId !== currentUserId);
	if (others.length === 0 && conversation.participants.length > 0) {
		return conversation.participants[0].username;
	}

	const label = others.map((participant) => participant.username).join(", ");
	return label || "Direct Message";
};

const getConversationAvatar = (conversation: ConversationSummaryDTO, currentUserId?: string | null) => {
	const others = conversation.participants.filter((participant) => participant.publicId !== currentUserId);
	return others[0]?.avatar || conversation.participants[0]?.avatar || "";
};

const Messages = () => {
	const theme = useTheme();
	const location = useLocation();
	const navigate = useNavigate();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));
	const [draftBody, setDraftBody] = useState("");
	const { user } = useAuth();
	const messagesContainerRef = useRef<HTMLDivElement | null>(null);
	const [showConversationsOnMobile, setShowConversationsOnMobile] = useState(true);
	const lastMessageCountRef = useRef<number>(0);
	const markedAsReadRef = useRef<Set<string>>(new Set());
	const conversationsQuery = useConversations();

	const conversations = useMemo(
		() => conversationsQuery.data?.pages.flatMap((p) => p.conversations) ?? [],
		[conversationsQuery.data]
	);

	const selectedConversationId = useMemo(() => {
		const params = new URLSearchParams(location.search);
		return params.get("conversation");
	}, [location.search]);

	const firstConversationId = conversations[0]?.publicId;

	useEffect(() => {
		if (!selectedConversationId && firstConversationId) {
			navigate(`?conversation=${firstConversationId}`, { replace: true });
		}
	}, [firstConversationId, selectedConversationId, navigate]);

	const markConversationRead = useMarkConversationRead();
	const selectedConversation = useMemo(() => {
		return conversations.find((c) => c.publicId === selectedConversationId);
	}, [conversations, selectedConversationId]);

	useEffect(() => {
		if (
			selectedConversation &&
			selectedConversation.unreadCount > 0 &&
			!markedAsReadRef.current.has(selectedConversation.publicId)
		) {
			markedAsReadRef.current.add(selectedConversation.publicId);
			markConversationRead.mutate(selectedConversation.publicId);
		}
		// reset tracking when conversation changes or unread count goes to 0
		if (selectedConversation && selectedConversation.unreadCount === 0) {
			markedAsReadRef.current.delete(selectedConversation.publicId);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedConversation?.publicId, selectedConversation?.unreadCount]);

	const messagesQuery = useConversationMessages(selectedConversationId);

	const messages = useMemo(() => {
		const pages = messagesQuery.data?.pages ?? [];
		const flattened = pages.flatMap((page) => page.messages);
		return [...flattened].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	}, [messagesQuery.data?.pages]);

	useEffect(() => {
		if (!messagesContainerRef.current) return;
		if (!selectedConversationId) return;

		const currentCount = messages.length;
		const shouldScroll = currentCount > lastMessageCountRef.current;
		lastMessageCountRef.current = currentCount;

		if (shouldScroll) {
			messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior: "smooth" });
		}
	}, [messages, selectedConversationId]);

	const sendMessage = useSendMessage();

	const handleSelectConversation = (conversationId: string) => {
		navigate(`?conversation=${conversationId}`);
		if (isMobile) {
			setShowConversationsOnMobile(false);
		}
	};
	const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (!draftBody.trim() || !selectedConversationId) return;

		await sendMessage.mutateAsync({
			conversationPublicId: selectedConversationId,
			body: draftBody.trim(),
		});

		setDraftBody("");
		requestAnimationFrame(() => {
			if (messagesContainerRef.current) {
				messagesContainerRef.current.scrollTo({
					top: messagesContainerRef.current.scrollHeight,
					behavior: "smooth",
				});
			}
		});
	};

	const handleBackToList = () => {
		if (isMobile) {
			setShowConversationsOnMobile(true);
		}
	};

	const renderMessageBubble = (message: MessageDTO) => {
		const isOwnMessage = message.sender.publicId === user?.publicId;
		return (
			<Box
				key={message.publicId}
				sx={{
					display: "flex",
					justifyContent: isOwnMessage ? "flex-end" : "flex-start",
					mb: 1.5,
				}}
			>
				<Box
					sx={{
						maxWidth: "80%",
						px: 2,
						py: 1.5,
						borderRadius: 2,
						backgroundColor: isOwnMessage ? theme.palette.primary.main : "rgba(99, 102, 241, 0.08)",
						color: isOwnMessage ? theme.palette.primary.contrastText : theme.palette.text.primary,
					}}
				>
					{!isOwnMessage && (
						<Typography variant="caption" sx={{ display: "block", mb: 0.5, opacity: 0.7 }}>
							{message.sender.username}
						</Typography>
					)}
					<Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
						{message.body}
					</Typography>
					<Typography variant="caption" sx={{ display: "block", mt: 0.75, opacity: 0.7 }}>
						{formatTimestamp(message.createdAt)}
					</Typography>
				</Box>
			</Box>
		);
	};

	return (
		<Box
			sx={{
				display: "flex",
				flexDirection: isMobile ? "column" : "row",
				height: "100vh",
				maxHeight: "100vh",
				overflow: "hidden",
				background: "linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(29, 38, 125, 0.7) 100%)",
				color: theme.palette.text.primary,
			}}
		>
			{/* Conversation List */}
			<Box
				sx={{
					width: isMobile ? "100%" : CONVERSATION_PANEL_WIDTH,
					display: isMobile && !showConversationsOnMobile ? "none" : "flex",
					flexDirection: "column",
					borderRight: isMobile ? "none" : `1px solid ${theme.palette.divider}`,
					backgroundColor: "rgba(15, 23, 42, 0.85)",
				}}
			>
				<Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1 }}>
					<ChatBubbleOutlineIcon color="primary" />
					<Typography variant="h6" fontWeight={700}>
						Messages
					</Typography>
				</Box>
				<Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
				<Box sx={{ flex: 1, overflowY: "auto" }}>
					{conversationsQuery.isLoading ? (
						<Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
							<CircularProgress size={32} />
						</Box>
					) : conversations.length === 0 ? (
						<Box sx={{ p: 3 }}>
							<Typography variant="body2" color="text.secondary">
								No conversations yet. Start a chat from a user profile to begin messaging.
							</Typography>
						</Box>
					) : (
						<List disablePadding>
							{conversations.map((conversation) => {
								const title = getConversationTitle(conversation, user?.publicId);
								const avatarUrl = getConversationAvatar(conversation, user?.publicId);
								const lastMessagePreview = conversation.lastMessage?.body ?? "No messages yet";

								return (
									<ListItemButton
										key={conversation.publicId}
										selected={conversation.publicId === selectedConversationId}
										onClick={() => handleSelectConversation(conversation.publicId)}
										sx={{ alignItems: "flex-start", py: 1.5, px: 2 }}
									>
										<ListItem alignItems="flex-start" disableGutters sx={{ width: "100%" }}>
											<ListItemAvatar>
												<Badge color="primary" variant={conversation.unreadCount > 0 ? "dot" : "standard"}>
													<Avatar src={avatarUrl} alt={title} />
												</Badge>
											</ListItemAvatar>
											<ListItemText
												primary={
													<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
														<Typography variant="subtitle1" fontWeight={600} noWrap>
															{title}
														</Typography>
														<Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
															{conversation.lastMessageAt ? formatTimestamp(conversation.lastMessageAt) : ""}
														</Typography>
													</Box>
												}
												secondary={
													<Typography variant="body2" color="text.secondary" noWrap>
														{lastMessagePreview}
													</Typography>
												}
											/>
										</ListItem>
									</ListItemButton>
								);
							})}
						</List>
					)}
				</Box>

				{conversationsQuery.hasNextPage && (
					<Box sx={{ p: 2 }}>
						<Button
							variant="outlined"
							fullWidth
							onClick={() => conversationsQuery.fetchNextPage()}
							disabled={conversationsQuery.isFetchingNextPage}
						>
							{conversationsQuery.isFetchingNextPage ? "Loading..." : "Load more"}
						</Button>
					</Box>
				)}
			</Box>

			{/* Messages Panel */}
			<Box
				sx={{
					flex: 1,
					display: isMobile && showConversationsOnMobile ? "none" : "flex",
					flexDirection: "column",
					backgroundColor: "rgba(13, 20, 35, 0.88)",
					minHeight: 0,
					overflow: "hidden",
				}}
			>
				<Box sx={{ p: 3, display: "flex", alignItems: "center", gap: 1 }}>
					{isMobile && (
						<IconButton size="small" onClick={handleBackToList} sx={{ mr: 1 }}>
							<ArrowBackIosNewRoundedIcon fontSize="small" />
						</IconButton>
					)}
				</Box>
				<Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

				{!selectedConversationId ? (
					<Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
						<Typography variant="body1" color="text.secondary">
							Choose a conversation to start chatting.
						</Typography>
					</Box>
				) : (
					<>
						<Box
							ref={messagesContainerRef}
							sx={{
								flex: 1,
								overflowY: "auto",
								px: { xs: 2, md: 4 },
								py: 3,
								minHeight: 0,
							}}
						>
							{messagesQuery.isLoading ? (
								<Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
									<CircularProgress size={32} />
								</Box>
							) : (
								<>
									{messagesQuery.hasNextPage && (
										<Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
											<Button
												variant="text"
												size="small"
												onClick={() => messagesQuery.fetchNextPage()}
												disabled={messagesQuery.isFetchingNextPage}
											>
												{messagesQuery.isFetchingNextPage ? "Loading..." : "Load older messages"}
											</Button>
										</Box>
									)}
									{messages.length === 0 ? (
										<Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
											No messages yet. Say hello!
										</Typography>
									) : (
										messages.map((message) => renderMessageBubble(message))
									)}
								</>
							)}
						</Box>

						<Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

						<Box component="form" onSubmit={handleSendMessage} sx={{ p: { xs: 2, md: 3 } }}>
							<Paper
								elevation={0}
								sx={{
									px: 2,
									py: 1,
									backgroundColor: "rgba(15, 23, 42, 0.75)",
									borderRadius: 3,
									border: `1px solid ${theme.palette.primary.main}33`,
								}}
							>
								<TextField
									fullWidth
									variant="standard"
									placeholder="Type your message..."
									value={draftBody}
									onChange={(event) => setDraftBody(event.target.value)}
									InputProps={{
										disableUnderline: true,
										endAdornment: (
											<InputAdornment position="end">
												<IconButton type="submit" color="primary" disabled={sendMessage.isPending || !draftBody.trim()}>
													<SendRoundedIcon />
												</IconButton>
											</InputAdornment>
										),
									}}
									inputProps={{
										sx: { color: "inherit", py: 1 },
									}}
								/>
							</Paper>
						</Box>
					</>
				)}
			</Box>
		</Box>
	);
};

export default Messages;
