import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  toggleCommentDislike,
  toggleTweetDislike,
  toggleVideoDislike,
} from "../controllers/dislike.controller.js";

const router = Router();

router.use(verifyJWT);
router.route("/toggle/dislike/v/:videoId").post(toggleVideoDislike);
router.route("/toggle/dislike/c/:commentId").post(toggleCommentDislike);
router.route("/toggle/dislike/t/:tweetId").post(toggleTweetDislike);

export default router;
