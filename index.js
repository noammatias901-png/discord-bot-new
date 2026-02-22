// ===== Express כדי Render לא יתלונן =====
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

// ===== Discord.js =====
const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelType,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ חסר TOKEN / CLIENT_ID / GUILD_ID ב-ENV");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== רולים =====
const ROLE_CRIME = "Crime Permit";
const ROLE_BLACKMARKET = "Black market buyer";

// ===== רישום פקודות =====
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('שולח את הודעת בחירת הרולים')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('בודק אם הבוט חי')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered.');
  } catch (err) {
    console.error("❌ Error registering slash commands:", err);
  }
})();

// ===== לוגים =====
async function sendLog(guild, messageContent) {
  const channel = guild.channels.cache.find(
    ch => ch.name === '🤖-bot-logs'
  );

  if (!channel) {
    console.log("❌ לא נמצא חדר לוגים");
    return;
  }

  channel.send({ content: messageContent }).catch(err => {
    console.error("❌ שגיאה בשליחת לוג:", err);
  });
}
// ===== מוכן =====
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ===== אינטראקציות =====
client.on('interactionCreate', async (interaction) => {

  try {

    // ===== Slash =====
    if (interaction.isChatInputCommand()) {

      if (interaction.commandName === 'setup') {

        const embed = new EmbedBuilder()
  .setTitle('🛡️ מערכת אימות - PG-CRIME')
  .setDescription(
`על מנת לקבל גישה לכל ערוצי השרת ולהתחיל לשחק, עליך לעבור אימות קצר.

בלחיצה על הכפתור למטה:
• תקבלו את הרול הרשמי של חברי הקהילה.
• כל החדרים ייפתחו עבורכם.
• תוכלו להתחיל להציע הצעות ולדבר עם כולם.`
  )
  .setColor('Red');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('crime_role')
            .setLabel('Crime Permit')
            .setStyle(ButtonStyle.Danger),

          new ButtonBuilder()
            .setCustomId('blackmarket_role')
            .setLabel('Black market buyer')
            .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row] });
      }

      if (interaction.commandName === 'ping') {
        await interaction.reply({ content: 'pong 🏓' });
      }
    }

    // ===== כפתורים =====
    if (interaction.isButton()) {

      await interaction.deferReply({ ephemeral: true });

      const member = await interaction.guild.members.fetch(interaction.user.id);

      let roleName;
      if (interaction.customId === 'crime_role') roleName = ROLE_CRIME;
      else if (interaction.customId === 'blackmarket_role') roleName = ROLE_BLACKMARKET;
      else return;

      const role = interaction.guild.roles.cache.find(r => r.name === roleName);

      if (!role)
        return interaction.editReply({ content: '❌ הרול לא נמצא!' });

      if (member.roles.cache.has(role.id))
        return interaction.editReply({ content: 'כבר יש לך את הרול הזה ✅' });

      // בדיקת היררכיה
      if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles))
        return interaction.editReply({ content: '❌ לבוט אין הרשאת Manage Roles' });

      if (role.position >= interaction.guild.members.me.roles.highest.position)
        return interaction.editReply({ content: '❌ הרול מעל הבוט בהיררכיה' });

      await member.roles.add(role);

      await interaction.editReply({
        content: `🎉 קיבלת את הרול ${roleName}!`
      });

      await sendLog(interaction.guild,
        `🟢 ${member.user.tag} קיבל את הרול ${roleName}`
      );
    }

  } catch (err) {
    console.error("❌ Interaction Error:", err);

    if (interaction.replied || interaction.deferred) {
      await interaction.editReply({ content: "❌ קרתה שגיאה במערכת" }).catch(() => {});
    } else {
      await interaction.reply({ content: "❌ קרתה שגיאה במערכת", ephemeral: true }).catch(() => {});
    }
  }
});

// ===== התחברות =====
client.login(TOKEN);