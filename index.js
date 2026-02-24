// ===== Express =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));


// ===== Discord =====
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const SETUP_CHANNEL_NAME = "✅┃verify"; // חדר setup
const LOG_CHANNEL_NAME = "🤖-bot-logs"; // חדר לוגים

if (!TOKEN || !GUILD_ID) {
  console.error("❌ חסר TOKEN / GUILD_ID ב-ENV");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,            // כדי לגשת לשרת
    GatewayIntentBits.GuildMembers,      // כדי לגשת לחברי השרת
    GatewayIntentBits.GuildMessages,     // אם קורא הודעות
    GatewayIntentBits.MessageContent     // חובה לקרוא הודעות ותוכן (ל‑DM Bot)
  ],
partials: ['CHANNEL', 'GUILD_MEMBER', 'MESSAGE', 'USER'] // חובה ל-DM ולחלקי מידע
});

// ===== רולים =====
 const ROLES = {
  CRIME: "Crime Permit",
  SOLO_CRIME: "Solo Crime",
  FAMILY: "crime family",
  LOGS: "logs"
};

// ===== פונקציית לוגים עם Embed מקצועי =====
async function sendLog(guild, member, actionText) {
  const channel = guild.channels.cache.find(ch => ch.name === LOG_CHANNEL_NAME);
  if (!channel) return;

  // שולח לוג רק אם למשתמש יש רול logs
  if (!member.roles.cache.some(r => r.name === ROLES.LOGS)) return;

  const embed = new EmbedBuilder()
    .setColor('Red')
    .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
    .setTitle('📊 מערכת לוגים - PG-CRIME')
    .setDescription(actionText)
    .setTimestamp()
    .setFooter({ text: 'מערכת אוטומטית' });

  await channel.send({ embeds: [embed] }).catch(() => {});
}

// ===== מחיקה אוטומטית של הודעות Setup ישנות =====
async function cleanOldSetupMessages(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  messages.forEach(msg => {
    if (msg.author.id === client.user.id) msg.delete().catch(() => {});
  });
}

// ===== שליחת הודעת Setup חדשה עם Toggle =====
async function sendSetupMessage(guild) {
  const channel = guild.channels.cache.find(ch => ch.name === SETUP_CHANNEL_NAME);
  if (!channel) {
    console.error("❌ חדר verify לא נמצא"); // שגיאה בלוגים
    return; // יוצא מהפונקציה כדי לא להריץ שאר הקוד
  }

  // מחיקת הודעות ישנות
  await cleanOldSetupMessages(channel);

  const embed = new EmbedBuilder()
  .setColor('#FF0000')
  .setTitle('🛡️ מערכת אימות - PG-CRIME')
  .setDescription(`ברוך הבא לשרת!
לחץ על אחד הכפתורים כדי לקבל רול.

**Crime Permit**
רול המחוייב לכל שחקן בשרת אשר משתייך לארגון או כסולו

**Solo Crime**
רול המקשר אותך לפעילות פשע כסולו

**crime family**
רול המקשר אותך למשפחת פשע

לחיצה חוזרת תסיר את הרול (Toggle).`)
  .setThumbnail(client.user.displayAvatarURL())
  .setFooter({ text: 'PG-CRIME • © All Rights Reserved To No4M', iconURL: client.user.displayAvatarURL() });
 const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder()
    .setCustomId('crime_role')
    .setLabel(ROLES.CRIME)
    .setStyle(ButtonStyle.Danger),

  new ButtonBuilder()
    .setCustomId('solo_crime_role')
    .setLabel(ROLES.SOLO_CRIME)
    .setStyle(ButtonStyle.Secondary),

  new ButtonBuilder()
    .setCustomId('family_role')
    .setLabel(ROLES.FAMILY)
    .setStyle(ButtonStyle.Success)
);

  await channel.send({ embeds: [embed], components: [row] });
}

// ===== READY =====
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  await sendSetupMessage(guild);
});

// ===== אינטראקציות =====
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = await interaction.guild.members.fetch(interaction.user.id);

   const roleMap = {
  crime_role: ROLES.CRIME,
  solo_crime_role: ROLES.SOLO_CRIME,
  family_role: ROLES.FAMILY
};
    const roleName = roleMap[interaction.customId];
    if (!roleName) return;

    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return interaction.editReply({ content: '❌ הרול לא נמצא!' });

    const botMember = interaction.guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles))
      return interaction.editReply({ content: '❌ לבוט אין הרשאת Manage Roles' });

    if (role.position >= botMember.roles.highest.position)
      return interaction.editReply({ content: '❌ הרול מעל הבוט בהיררכיה' });

    // 🔄 Toggle: אם כבר יש → מסיר
    if (member.roles.cache.has(role.id)) {
      await member.roles.remove(role);
      await interaction.editReply({ content: `🟡 הרול ${roleName} הוסר ממך.` });

      await sendLog(interaction.guild, member, `הוסר הרול ${roleName}`);
      return;
    }

    // אם אין רול → מוסיף
    await member.roles.add(role);
    await interaction.editReply({ content: `🎉 קיבלת את הרול ${roleName}!` });

    await sendLog(interaction.guild, member, `קיבל את הרול ${roleName}`);

  } catch (err) {
    console.error("❌ Interaction Error:", err);

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: "❌ קרתה שגיאה במערכת" }).catch(() => {});
    } else {
      await interaction.reply({ content: "❌ קרתה שגיאה במערכת", flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
});

client.login(TOKEN);