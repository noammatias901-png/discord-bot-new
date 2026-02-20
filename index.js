require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionFlagsBits, ChannelType, OverwriteType } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

let roles = {};
try {
  const data = fs.readFileSync('roles.json', 'utf8');
  roles = JSON.parse(data);
} catch (err) {
  console.error('Error reading roles.json:', err);
}

const balances = {};

async function sendLog(guild, roleKey, messageContent) {
  const roleName = roles[roleKey];
  if (!roleName) return;

  const channel = guild.channels.cache.find((ch) => {
    if (ch.type !== ChannelType.GuildText) return false;
    if (!ch.permissionOverwrites?.cache?.size) return false;

    return ch.permissionOverwrites.cache.some((po) =>
      po.type === OverwriteType.Role
      && po.allow.has(PermissionFlagsBits.ViewChannel)
      && ((roleKey === 'logs' && ch.name.includes('bot-logs'))
        || (roleKey === 'highLogs' && ch.name.includes('loggers-management'))),
    );
  });

  if (!channel) return;
  await channel.send({ content: messageContent }).catch(() => {});
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, guild } = interaction;
  const member = interaction.member;
  const isStaff = member?.permissions?.has(PermissionFlagsBits.ManageMessages);

  try {
    if (commandName === 'cleaning') {
      if (!isStaff) return interaction.reply({ content: 'אין לך הרשאות', ephemeral: true });
      const amount = options.getInteger('amount');
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      await interaction.channel.bulkDelete(messages, true);
      await interaction.reply({ content: `נמחקו ${messages.size} הודעות`, ephemeral: true });
      await sendLog(guild, 'logs', `${member.user.tag} מחק ${messages.size} הודעות בערוץ ${interaction.channel.name}`);
    } else if (commandName === 'clearuser') {
      if (!isStaff) return interaction.reply({ content: 'אין לך הרשאות', ephemeral: true });
      const user = options.getUser('user');
      const amount = options.getInteger('amount');
      const fetched = await interaction.channel.messages.fetch({ limit: 100 });
      const userMessages = fetched.filter((msg) => msg.author.id === user.id).first(amount);
      for (const msg of userMessages) {
        await msg.delete().catch(() => {});
      }
      await interaction.reply({ content: `נמחקו ${userMessages.length} הודעות של ${user.tag}`, ephemeral: true });
      await sendLog(guild, 'logs', `${member.user.tag} מחק ${userMessages.length} הודעות של ${user.tag}`);
    } else if (commandName === 'userinfo') {
      const target = options.getUser('target');
      const memberTarget = guild.members.cache.get(target.id);
      const embed = new EmbedBuilder()
        .setTitle(`User Info: ${target.tag}`)
        .addFields(
          { name: 'ID', value: target.id, inline: true },
          { name: 'Roles', value: memberTarget.roles.cache.map((r) => r.name).join(', '), inline: false },
          { name: 'Joined', value: memberTarget.joinedAt.toDateString(), inline: true },
        )
        .setColor('Blue');
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'serverinfo') {
      const embed = new EmbedBuilder()
        .setTitle(`Server Info: ${guild.name}`)
        .addFields(
          { name: 'Members', value: guild.memberCount.toString(), inline: true },
          { name: 'Channels', value: guild.channels.cache.size.toString(), inline: true },
          { name: 'Roles', value: guild.roles.cache.size.toString(), inline: true },
        )
        .setColor('Green');
      await interaction.reply({ embeds: [embed] });
    } else if (commandName === 'remind') {
      const text = options.getString('text');
      const minutes = options.getInteger('minutes');
      await interaction.reply({ content: `אני אזכיר לך בעוד ${minutes} דקות!`, ephemeral: true });
      setTimeout(() => {
        interaction.user.send(`Reminder: ${text}`).catch(() => {});
      }, minutes * 60000);
    } else if (commandName === 'balance') {
      const id = member.id;
      if (!balances[id]) balances[id] = 0;
      await interaction.reply({ content: `הכסף שלך: ${balances[id]} 💰` });
    } else if (commandName === 'give') {
      const target = options.getUser('user');
      const amount = options.getInteger('amount');
      const giverId = member.id;
      if (!balances[giverId]) balances[giverId] = 0;
      if (balances[giverId] < amount) return interaction.reply({ content: 'אין לך מספיק כסף!' });
      if (!balances[target.id]) balances[target.id] = 0;
      balances[giverId] -= amount;
      balances[target.id] += amount;
      await interaction.reply({ content: `${member.user.tag} נתן ${amount} 💰 ל־${target.tag}` });
      await sendLog(guild, 'highLogs', `${member.user.tag} נתן ${amount} 💰 ל־${target.tag}`);
    } else if (commandName === 'verify') {
      await interaction.deferReply({ ephemeral: true });

      const roleName = roles.crime;
      const role = guild.roles.cache.find((r) => r.name === roleName);
      if (!role) {
        return interaction.editReply({ content: 'Role לא נמצא בשרת!' });
      }

      const guildMember = await guild.members.fetch(interaction.user.id);
      if (guildMember.roles.cache.has(role.id)) {
        return interaction.editReply({ content: `כבר יש לך את הרול ${roleName}!` });
      }

      await guildMember.roles.add(role);
      await interaction.editReply({ content: `קיבלת את הרול ${roleName}!` });
      await sendLog(guild, 'logs', `${guildMember.user.tag} קיבל את רול ${roleName}`);
    }
  } catch (err) {
    console.error('Interaction error:', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'אירעה שגיאה בביצוע הפקודה!' }).catch(() => {});
    } else {
      await interaction.reply({ content: 'אירעה שגיאה בביצוע הפקודה!', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.TOKEN);
