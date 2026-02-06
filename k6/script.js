import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 200 }, // Ramp up to 200 users
    { duration: '1m', target: 500 },  // Ramp up to 500 users
    { duration: '2m', target: 1000 }, // Ramp up to 1000 users
    { duration: '2m', target: 1000 }, // Stay at 1000
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // Relaxed threshold for heavy writes
  },
};

const BASE_URL = 'http://api-gateway:8000';

const SAMPLE_IMAGES = [
  '1 Basic Reading.png',
  'aRBjL5G_700b.jpg',
  'absolute_state_of_UHG.jpg',
  'd6632c83a918e78d.jpg',
  'EVIDENCE.jpg',
  'federal-agent.jpg',
  'gigastacy.png',
  'homerwallpaper.jpg',
  'invictus-gaming-at-lol-world-2019-group-stage.jpg',
  'wallpaper.jpg'
];

// Pre-load images in init stage
const LOADED_IMAGES = {};
SAMPLE_IMAGES.forEach(filename => {
    LOADED_IMAGES[filename] = open(`/scripts/sample-images/${filename}`, 'b');
});

export default function () {
  // Custom random string generator
  const randomAlphanumeric = (length) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let res = '';
    while (length--) res += charset[Math.floor(Math.random() * charset.length)];
    return res;
  };

  // --- 1. Registration ---
  const email = `testuser_${randomAlphanumeric(8)}@example.com`;
  const nameBase = randomAlphanumeric(8);
  const handle = `user_${nameBase}`; // Handle allows underscores
  const username = `User${nameBase}`; // Username: strict alphanumeric
  const password = 'password123';

  const registerPayload = JSON.stringify({
    email: email,
    handle: handle,
    username: username,
    password: password,
    confirmPassword: password,
  });

  const headers = {
    'Content-Type': 'application/json',
  };

  let res = http.post(`${BASE_URL}/api/users/register`, registerPayload, { headers });
  
  if (res.status !== 201) {
      console.error(`Registration failed: ${res.body}`);
      return;
  }

  const authToken = res.json('token');
  const authHeaders = {
    'Authorization': `Bearer ${authToken}`,
  };
  const jsonAuthHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  sleep(1);

  // --- 2. Post an Image (Randomly) ---
  let myPostId = null;
  if (Math.random() < 0.3) { // 30% chance to post
      const randomImageName = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
      const imageFile = LOADED_IMAGES[randomImageName];
      
      const postData = {
          caption: `Stress test post ${randomString(5)} #stresstest`,
          image: http.file(imageFile, randomImageName),
      };

      res = http.post(`${BASE_URL}/api/posts`, postData, { headers: authHeaders }); // Multipart handled automatically
      
      check(res, {
          'post created': (r) => r.status === 201,
      });
      
      if (res.status === 201) {
          myPostId = res.json('publicId') || res.json('id');
      }
      sleep(2);
  }

  // --- 3. Browse Feed ---
  res = http.get(`${BASE_URL}/api/feed`, { headers: jsonAuthHeaders });
  check(res, {
    'feed retrieved': (r) => r.status === 200,
  });

  const feedPosts = res.json('posts');

  if (feedPosts && feedPosts.length > 0) {
      const randomPost = feedPosts[Math.floor(Math.random() * feedPosts.length)];
      const postId = randomPost.publicId || randomPost.id;
      
      if (postId) {
          // --- 4. Interact with Post (Like) ---
          if (Math.random() < 0.5) {
              res = http.post(`${BASE_URL}/api/users/like/post/${postId}`, {}, { headers: jsonAuthHeaders });
              check(res, { 'post liked': (r) => r.status === 200 || r.status === 201 });
          }

          // --- 5. Interact with Post (Comment) ---
          if (Math.random() < 0.3) {
             const commentPayload = JSON.stringify({
                 content: `Nice post! ${randomString(5)}`
             });
             res = http.post(`${BASE_URL}/api/posts/${postId}/comments`, commentPayload, { headers: jsonAuthHeaders });
             check(res, { 'comment added': (r) => r.status === 201 });
          }
      }
  }

  // --- 6. Delete My Post (Randomly) ---
  if (myPostId && Math.random() < 0.5) { // 50% chance to delete own post if created
      sleep(2); // Wait a bit before deleting
      res = http.del(`${BASE_URL}/api/posts/${myPostId}`, {}, { headers: jsonAuthHeaders });
      check(res, { 'post deleted': (r) => r.status === 200 });
  }

  sleep(Math.random() * 5); // Think time
}