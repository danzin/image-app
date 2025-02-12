import React, { useState } from "react";
import { IconButton, Badge, Menu, MenuItem } from "@mui/material";
import { Notifications as NotificationsIcon } from "@mui/icons-material";
import { useNotifications } from "../hooks/notifications/useNotification";

const NotificationBell = () => {
  const { notifications, markAsRead } = useNotifications();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (notificationId: string) => {
    markAsRead(notificationId); 
    handleClose();
  };

  return (
    <>
      <IconButton size="large" color="inherit" onClick={handleOpen}>
        <Badge badgeContent={notifications.filter((n) => !n.isRead).length} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {notifications.length === 0 ? (
          <MenuItem>No new notifications</MenuItem>
        ) : (
          notifications.map((notification) => (
            <MenuItem key={notification.id} onClick={() => handleNotificationClick(notification.id)}>
              {notification.actionType} by {notification.actorId.username}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
};

export default NotificationBell;
