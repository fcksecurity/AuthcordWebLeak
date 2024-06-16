const express = require('express');
const router = express.Router();
const User = require('../models/user');
const argon2 = require('argon2');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const fetch = import('node-fetch');
const https = require('https');
const emailValidator = require('email-validator');
const csrf = require('csurf');

// Nodemailer transporter setup with Mailinator
const transporter = nodemailer.createTransport({
		host: 'smtp.zoho.eu',
		port: 465,
		secure: true,
		auth: {
				user: 'support@authcord.lol',
				pass: process.env['a'],
		},
});

// CSRF protection middleware
const csrfProtection = csrf();
router.use(csrfProtection);

// Middleware to pass CSRF token to all views
router.use((req, res, next) => {
		res.locals.csrfToken = req.csrfToken();
		next();
});

const activeSessions = {};
const sessionLimits = {};

router.get('/', (req, res, next) => {
		if (sessionLimits[req.session.id] && sessionLimits[req.session.id].bannedUntil > Date.now()) {
				res.send({ "Success": "You are banned for 5 minutes. Please try again later." });
				return;
		}
		return res.render('index.ejs');
});

router.post('/', async (req, res, next) => {
		let personInfo = req.body;

		// Check if required fields are present
		if (!personInfo.email || !personInfo.username || !personInfo.password || !personInfo.passwordConf) {
				res.send({ "Success": "Missing information." });
				return;
		}

		// Validate email format and domain using email-validator
		if (!emailValidator.validate(personInfo.email)) {
				res.send({ "Success": "Invalid email format." });
				return;
		}

		// Check if email is real and exists
		try {
				const validEmail = emailValidator.validate(personInfo.email);
				if (!validEmail) {
						res.send({ "Success": "Please use a valid email address." });
						return;
				}
		} catch (err) {
				console.error(err);
				res.status(500).send({ "Error": "Server error." });
				return;
		}

		// Check if passwords match
		if (personInfo.password !== personInfo.passwordConf) {
				res.send({ "Success": "Passwords do not match." });
				return;
		}

		// Check if session already used for creating an account
		if (activeSessions[req.session.id]) {
				res.send({ "Success": "Session has already created an account." });
				return;
		}

		if (sessionLimits[req.session.id] && sessionLimits[req.session.id].bannedUntil > Date.now()) {
				res.send({ "Success": "You are banned for 5 minutes. Please try again later." });
				return;
		}

		// Limit user actions and set ban
		if (!sessionLimits[req.session.id]) {
				sessionLimits[req.session.id] = { attempts: 1 };
		} else {
				sessionLimits[req.session.id].attempts++;
				if (sessionLimits[req.session.id].attempts > 3) {
						sessionLimits[req.session.id].bannedUntil = Date.now() + 300000; // 5 minutes ban
						res.send({ "Success": "You are banned for 5 minutes. Please try again later." });
						return;
				}
		}

		try {
				// Check if email or username is already used
				const existingEmail = await User.findOne({ email: personInfo.email });
				if (existingEmail) {
						res.send({ "Success": "Email is already used." });
						return;
				}

				const existingUsername = await User.findOne({ username: personInfo.username });
				if (existingUsername) {
						res.send({ "Success": "Username is already used." });
						return;
				}

				// Hash passwords using argon2
				const hash = await argon2.hash(personInfo.password);
				const hashConf = await argon2.hash(personInfo.passwordConf);

				// Generate email token
				const token = crypto.randomBytes(20).toString('hex');

				// Save new user to database
				const newUser = new User({
						email: personInfo.email,
						username: personInfo.username,
						password: hash,
						passwordConf: hashConf,
						emailToken: token,
						isVerified: false
				});

				await newUser.save();

				activeSessions[req.session.id] = true;

				// Send confirmation email
				const mailOptions = {
						to: personInfo.email,
						from: 'support@authcord.lol', // Update with your email address
						subject: 'Email Confirmation',
						text: `Please confirm your email by clicking the following link: \n\nhttp:\/\/${req.headers.host}\/confirmation\/${token}\n\n`
				};

				transporter.sendMail(mailOptions, (err, response) => {
						if (err) {
								console.log(err);
								res.send({ "Success": "Error sending confirmation email." });
						} else {
								res.send({ "Success": "A confirmation email has been sent to " + personInfo.email + "." });
						}
				});
		} catch (err) {
				console.error(err);
				res.status(500).send({ "Error": "Server error." });
		}
});

// Remaining unchanged code...


router.get('/login', (req, res, next) => {
		return res.render('login.ejs');
});

router.post('/login', (req, res, next) => {
		User.findOne({ email: req.body.email }, (err, data) => {
				if (data) {
						argon2.verify(data.password, req.body.password)
								.then(match => {
										if (match) {
												if (!data.isVerified) {
														res.send({ "Success": "Please confirm your email to login." });
												} else {
														req.session.userId = data.unique_id;
														res.send({ "Success": "Success!" });
												}
										} else {
												res.send({ "Success": "Wrong password!" });
										}
								})
								.catch(err => {
										console.log(err);
										res.send({ "Success": "Wrong password!" });
								});
				} else {
						res.send({ "Success": "This Email Is not registered!" });
				}
		});
});

router.get('/profile', (req, res, next) => {
		User.findOne({ unique_id: req.session.userId }, (err, data) => {
				if (!data) {
						res.redirect('/');
				} else {
						res.render('data.ejs', { name: data.username, email: data.email });
				}
		});
});

// Validation Functions


router.post('/add-bot', async (req, res) => {
		const { botToken, clientSecret, clientId, webhookUrl, ownerId } = req.body;

		// Validate inputs
		if (!botToken || !clientSecret || !clientId || !webhookUrl || !ownerId) {
				return res.json({ success: false, message: 'Missing required fields' });
		}

		// Validate ownerId with Discord API
		// try {
		//     const ownerResponse = await axios.get(`https://discord.com/api/v10/users/${ownerId}`, {
		//         headers: { Authorization: `Bot ${botToken}` }
		//     });
		//     if (!ownerResponse.data || !ownerResponse.data.id) {
		//         return res.json({ success: false, message: 'Invalid ownerId' });
		//     }
		// } catch (error) {
		//     return res.json({ success: false, message: 'Failed to validate ownerId with Discord API' });
		// }

		// Validate botToken
		// const client = new Client({ intents: [32767] });
		// try {
		//     await client.login(botToken);
		//     client.destroy(); // Logout immediately after successful login
		// } catch (error) {
		//     return res.json({ success: false, message: 'Invalid botToken' });
		// }
		// Find user and save new bot details
		User.findOne({ unique_id: req.session.userId }, (err, user) => {
				if (err || !user) {
						return res.json({ success: false, message: 'User not found' });
				}
				const newBot = { botToken, clientSecret, clientId, webhookUrl, ownerId };
				user.bots.push(newBot);
				user.botCount += 1;
				user.save((err) => {
						if (err) {
								return res.json({ success: false, message: 'Failed to save bot' });
						}
						// After saving to the database, start the bot with PM2
						const { exec } = require('child_process');
						const pm2 = require('pm2');
						exec(`pm2 start bot.js --name "${clientId}" -- --TOKEN "${botToken}" --CLIENT_ID "${clientId}" --CLIENT_SECRET "${clientSecret}" --WEBHOOK "${webhookUrl}" --OWNER_ID "${ownerId}"`, (error, stdout, stderr) => {
								if (error) {
										console.error(`PM2 start error: ${error.message}`);
										return;
								}
								if (stderr) {
										console.error(`PM2 start stderr: ${stderr}`);
										return;
								}
								console.log(`PM2 start stdout: ${stdout}`);
						});
						return res.json({ success: true, id: user.bots[user.bots.length - 1]._id });
				});
		});
});

// Route to get bots
router.get('/get-bots', (req, res) => {
		User.findOne({ unique_id: req.session.userId }, (err, user) => {
				if (err || !user) {
						return res.json({ success: false, bots: [] });
				}
				return res.json({ success: true, bots: user.bots });
		});
});
router.delete('/delete-bot/:id', (req, res) => {
	User.findOneAndUpdate(
			{ unique_id: req.session.userId },
			{ $pull: { bots: { _id: req.params.id } }, $inc: { botCount: -1 } },
			{ new: true },
			(err, user) => {
					if (err || !user) {
							return res.json({ success: false });
					}
					return res.json({ success: true });
			}
	);
});

router.get('/logout', (req, res, next) => {
	if (req.session) {
			req.session.destroy((err) => {
					if (err) {
							return next(err);
					} else {
							return res.redirect('/');
					}
			});
	}
});

router.get('/forgetpass', (req, res, next) => {
	res.render("forget.ejs");
});

router.post('/forgetpass', (req, res, next) => {
	User.findOne({ email: req.body.email }, (err, data) => {
			if (!data) {
					res.send({ "Success": "This Email Is not registered!" });
			} else {
					if (req.body.password == req.body.passwordConf) {
							argon2.hash(req.body.password)
									.then(hash => {
											argon2.hash(req.body.passwordConf)
													.then(hashConf => {
															data.password = hash;
															data.passwordConf = hashConf;

															data.save((err, Person) => {
																	if (err) console.log(err);
																	else console.log('Success');
																	res.send({ "Success": "Password changed!" });
															});
													})
													.catch(err => {
															console.log(err);
															res.send({ "Success": "Error hashing password confirmation." });
													});
									})
									.catch(err => {
											console.log(err);
											res.send({ "Success": "Error hashing password." });
									});
					} else {
							res.send({ "Success": "Password does not match! Both Password should be the same." });
					}
			}
	});
});


router.get('/confirmation/:token', (req, res, next) => {
		User.findOne({ emailToken: req.params.token }, (err, user) => {
				if (!user) {
						res.send({ "Success": "Token is invalid or expired." });
				} else {
						user.isVerified = true;
						user.emailToken = null;
						user.save((err) => {
								if (err) console.log(err);
								res.send({ "Success": "Your email has been confirmed!" });
						});
				}
		});
});


// handling CSRF token errors
router.use((err, req, res, next) => {
		if (err) {
				res.status(404).send("404 Page Not Found");
		}
});

module.exports = router;
