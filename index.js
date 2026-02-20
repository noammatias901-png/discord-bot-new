require('dotenv').config();
const fs = require('fs');
const { Client, Intents, Collection, MessageEmbed } = require('discord.js');

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

// קריאה ל־roles.json
let roles = {};
try {
  const data = fs.readFileSync('roles.json', 'utf8');
  roles = JSON.parse(data);
} catch (err) {
  console.error("Error reading roles.json:", err);
}

// אובייקט למעקב על כסף וירטואלי
const balances = {};

// פונקציה לשליחת לוגים לערוץ
async function sendLog(guild, roleKey, messageContent) {
  const roleName = roles[roleKey];
  if (!roleName) return;

  const channel = guild.channels.cache.find(ch => {
    const perms = ch.permissionOverwrites.cache;
    return perms.some(po => po.type === 'role' && po.allow.has('VIEW_CHANNEL') && ch.name.includes('bot-logs') || ch.name.includes('loggers-management'));
  });

  if (!channel) return;

  channel.send({ content: messageContent }).catch(() => {});
}

// Ready event
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.application.commands.set([
    {
      name: 'cleaning',
      description: 'מוחק מספר הודעות (רק לסטאף)',
      options: [{ name: 'amount', type: 'INTEGER', required: true, description: 'מספר ההודעות למחיקה' }]
    },
    {
      name: 'clearuser',
      description: 'מוחק הודעות של משתמש מסוים (רק לסטאף)',
      options: [
        { name: 'user', type: 'USER', required: true, description: 'המשתמש' },
        { name: 'amount', type: 'INTEGER', required: true, description: 'מספר הודעות' }
      ]
    },
    {
      name: 'userinfo',
      description: 'מציג מידע על משתמש',
      options: [{ name: 'target', type: 'USER', required: true, description: 'המשתמש' }]
    },
    { name: 'serverinfo', description: 'מציג מידע על השרת' },
    {
      name: 'remind',
      description: 'שולח תזכורת למשתמש לאחר זמן מוגדר',
      options: [
        { name: 'text', type: 'STRING', required: true, description: 'תוכן התזכורת' },
        { name: 'minutes', type: 'INTEGER', required: true, description: 'מספר דקות' }
      ]
    },
    { name: 'balance', description: 'מציג כסף וירטואלי של המשתמש' },
    {
      name: 'give',
      description: 'נותן כסף למשתמש אחר',
      options: [
        { name: 'user', type: 'USER', required: true, description: 'למי נותנים' },
        { name: 'amount', type: 'INTEGER', required: true, description: 'כמות כסף' }
      ]
    },
    { name: 'verify', description: 'נותן למשתמש את רול Crime Permit' }
  ]);
});

// Interaction event
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName, options, member, guild } = interaction;
  const isStaff = member.permissions.has('MANAGE_MESSAGES');

  // /cleaning
  if (commandName === 'cleaning') {
    if (!isStaff) return interaction.reply("אין לך הרשאות");
    const amount = options.getInteger('amount');
    const messages = await interaction.channel.messages.fetch({ limit: amount });
    await interaction.channel.bulkDelete(messages, true);
    interaction.reply({ content: `נמחקו ${messages.size} הודעות`, ephemeral: true });
    sendLog(guild, 'logs', `${member.user.tag} מחק ${messages.size} הודעות בערוץ ${interaction.channel.name}`);
  }

  // /clearuser
  else if (commandName === 'clearuser') {
    if (!isStaff) return interaction.reply("אין לך הרשאות");
    const user = options.getUser('user');
    const amount = options.getInteger('amount');
    const fetched = await interaction.channel.messages.fetch({ limit: 100 });
    const userMessages = fetched.filter(msg => msg.author.id === user.id).first(amount);
    for (const msg of userMessages) await msg.delete().catch(() => {});
    interaction.reply({ content: `נמחקו ${userMessages.length} הודעות של ${user.tag}`, ephemeral: true });
    sendLog(guild, 'logs', `${member.user.tag} מחק ${userMessages.length} הודעות של ${user.tag} בערוץ ${interaction.channel.name}`);
  }

  // /userinfo
  else if (commandName === 'userinfo') {
    const target = options.getUser('target');
    const memberTarget = guild.members.cache.get(target.id);
    const embed = new MessageEmbed()
      .setTitle(`User Info: ${target.tag}`)
      .addField('ID', target.id, true)
      .addField('Roles', memberTarget.roles.cache.map(r => r.name).join(', '), false)
      .addField('Joined', memberTarget.joinedAt.toDateString(), true)
      .setColor('BLUE');
    interaction.reply({ embeds: [embed] });
  }

  // /serverinfo
  else if (commandName === 'serverinfo') {
    const embed = new MessageEmbed()
      .setTitle(`Server Info: ${guild.name}`)
      .addField('Members', guild.memberCount.toString(), true)
      .addField('Channels', guild.channels.cache.size.toString(), true)
      .addField('Roles', guild.roles.cache.size.toString(), true)
      .setColor('GREEN');
    interaction.reply({ embeds: [embed] });
  }

  // /remind
  else if (commandName === 'remind') {
    const text = options.getString('text');
    const minutes = options.getInteger('minutes');
    interaction.reply({ content: `אני אזכיר לך בעוד ${minutes} דקות!`, ephemeral: true });
    setTimeout(() => {
      interaction.user.send(`Reminder: ${text}`).catch(() => {});
    }, minutes * 60000);
  }

  // /balance
  else if (commandName === 'balance') {
    const id = member.id;
    if (!balances[id]) balances[id] = 0;
    interaction.reply(`הכסף שלך: ${balances[id]} 💰`);
  }

  // /give
  else if (commandName === 'give') {
    const target = options.getUser('user');
    const amount = options.getInteger('amount');
    const giverId = member.id;
    if (!balances[giverId]) balances[giverId] = 0;
    if (balances[giverId] < amount) return interaction.reply("אין לך מספיק כסף!");
    if (!balances[target.id]) balances[target.id] = 0;
    balances[giverId] -= amount;
    balances[target.id] += amount;
    interaction.reply(`${member.user.tag} נתן ${amount} 💰 ל־${target.tag}`);
    sendLog(guild, 'highLogs', `${member.user.tag} נתן ${amount} 💰 ל־${target.tag}`);
  }

  // /verify
  else if (commandName === 'verify') {
    const role = guild.roles.cache.find(r => r.name === roles.crime);
    if (!role) return interaction.reply("Role לא נמצא!");
    await member.roles.add(role);
    interaction.reply({ content: `קיבלת את הרול ${roles.crime}!`, ephemeral: true });
    sendLog(guild, 'logs', `${member.user.tag} קיבל את רול ${roles.crime}`);
  }
});

// התחברות
client.login(process.env.TOKEN);