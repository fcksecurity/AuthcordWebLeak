const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const botSchema = new Schema({
		ownerId: String,
		botToken: String,
		clientId: String,
		clientSecret: String,
		webhookUrl: String,
		botPfp: String,
});

const userSchema = new Schema({
		unique_id: Number,
		email: String,
		username: String,
		password: String,
		passwordConf: String,
		emailToken: String,
		isVerified: { type: Boolean, default: false },
		discordId: { type: String, default: null },
		discordUsername: { type: String, default: null },
		bots: [botSchema],
		botCount: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
