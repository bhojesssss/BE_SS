import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import productsRoutes from "./routes/products.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import usersRoutes from './routes/users.routes.js';
import addressesRoutes from './routes/addresses.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import chatsRoutes from './routes/chats.routes.js';
import notificationsRoutes from './routes/notification.routes.js';
import transactionsRoutes from './routes/transaction.routes.js';
import cartRoutes from './routes/cart.routes.js';
import ordersRoutes from './routes/orders.routes.js';
// ... import other routes nanti
import { errorHandler } from "./middleware/errorHandler.js";

dotenv.config();
const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Health check
app.get("/", (req, res) => res.json({ ok: true, message: "SecondSpace API" }));

// Routes
app.use("/auth", authRoutes);
app.use("/products", productsRoutes);
app.use("/categories", categoriesRoutes);
app.use('/users', usersRoutes);
app.use('/addresses', addressesRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/chats', chatsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/transactions', transactionsRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', ordersRoutes);
// ... use other routes nanti

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});