import PublicProfileSettings from "../models/PublicProfileSettings.js";
import User from "../models/User.js";
import AggregatedStats from "../models/AggregatedStats.js";
import PlatformStats from "../models/PlatformStats.js";

export async function getPublicProfile(req, res) {
  try {
    const username = String(req.params.username || "").toLowerCase().trim();
    if (!username) return res.status(400).json({ success: false, message: "username required" });

    const settings = await PublicProfileSettings.findOne({ publicUsername: username, isPublic: true }).lean();
    if (!settings) return res.status(404).json({ success: false, message: "Profile not found" });

    await PublicProfileSettings.updateOne(
      { _id: settings._id },
      { $inc: { viewCount: 1 } }
    );

    const user = await User.findById(settings.userId).select("name profileImage createdAt").lean();
    const agg = await AggregatedStats.findOne({ userId: settings.userId }).lean();
    const platforms = await PlatformStats.find({ userId: settings.userId }).lean();

    res.json({
      success: true,
      data: {
        user: {
          name: user?.name,
          profileImage: user?.profileImage,
          joinedAt: user?.createdAt,
          publicUsername: settings.publicUsername,
        },
        settings,
        aggregated: agg,
        platforms,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Failed" });
  }
}
