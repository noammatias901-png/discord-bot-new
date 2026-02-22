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
  SlashCommandBuilder
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// ===== רולים =====
const ROLE_CRIME = "Crime Permit";
const ROLE_BLACKMARKET = "Black market buyer";

// ===== Environment Variables של Render =====
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ===== רישום פקודות אוטומטי =====
const commands = [
  new SlashCommandBuilder()
    .setName('setup')
    .setDescription('שולח את הודעת בחירת הרולים'),
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
    console.log('Slash commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

// ===== פונקציה לשליחת לוגים =====
async function sendLog(guild, messageContent) {
  const channel = guild.channels.cache.find(
    ch => ch.type === ChannelType.GuildText && ch.name === '🤖-bot-logs'
  );
  if (!channel) return;
  await channel.send({ content: messageContent }).catch(() => {});
}

// ===== אירוע מוכן =====
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// ===== אינטראקציות =====
client.on('interactionCreate', async (interaction) => {

  // ===== Slash Commands =====
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'setup') {

      const embed = new EmbedBuilder()
        .setTitle('🎭 Role Selection')
        .setDescription('בחר את הרול שאתה רוצה לקבל:')
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

    } else if (interaction.commandName === 'ping') {
      await interaction.reply({ content: 'pong 🏓' });
    }
  }

  // ===== לחיצה על כפתורים =====
  if (interaction.isButton()) {

    const member = await interaction.guild.members.fetch(interaction.user.id);

    let roleName;
    if (interaction.customId === 'crime_role') roleName = ROLE_CRIME;
    else if (interaction.customId === 'blackmarket_role') roleName = ROLE_BLACKMARKET;
    else return;

    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return interaction.reply({ content: 'הרול לא נמצא!', ephemeral: true });

    if (member.roles.cache.has(role.id)) {
      return interaction.reply({ content: 'כבר יש לך את הרול הזה ✅', ephemeral: true });
    }

    try {
      await member.roles.add(role);

      await interaction.reply({ content: `🎉 קיבלת את הרול ${roleName}!`, ephemeral: true });

      await sendLog(interaction.guild, `🟢 ${member.user.tag} קיבל את הרול ${roleName}`);

    } catch (err) {
      console.error(err);
      await interaction.reply({ content: '❌ שגיאה במתן הרול. בדוק הרשאות לבוט.', ephemeral: true });
    }
  }

});

// ===== התחברות לדיסקורד =====
client.login(process.env.TOKEN); // TOKEN מוגדר ב-Render