const { Client } = require('discord.js');

const args = process.argv.slice(2);
const TOKEN = args[args.indexOf('--TOKEN') + 1];
const CLIENT_ID = args[args.indexOf('--CLIENT_ID') + 1];
const CLIENT_SECRET = args[args.indexOf('--CLIENT_SECRET') + 1];
const WEBHOOK = args[args.indexOf('--WEBHOOK') + 1];
const OWNER_ID = args[args.indexOf('--OWNER_ID') + 1];


const client = new Client({ 
    intents: 32767 // This corresponds to Intents.ALL
});


const pingCommand = {
    name: 'ping',
    description: 'Replies with pong!'
};

// When the client is ready, execute this code
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);

    // Register the ping slash command
    client.guilds.cache.forEach(guild => {
        guild.commands.create(pingCommand).then(console.log).catch(console.error);
    });
});

// When a slash command interaction is received, execute this code
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    // Handle the ping command
    if (interaction.commandName === 'ping') {
        await interaction.reply('Pong!');
    }
});

// Login to Discord with the provided token
client.login(TOKEN).catch(console.error);