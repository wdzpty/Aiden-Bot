const express = require("express");
const { 
  Client, 
  GatewayIntentBits, 
  Partials,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder, 
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Servidor Express para UptimeRobot
const app = express();
app.get("/", (req, res) => res.send("Bot activo."));
app.listen(3000, () => console.log("🌐 Servidor web online para UptimeRobot"));

// Cliente Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// IDs de configuración
const WELCOME_CHANNEL_ID = "1377134082206470164";

const TICKET_OPEN_CHANNEL = "1376071216619716708";    // Canal donde se pone el botón para abrir ticket (Tickets)
const TICKET_CATEGORY = "1378208740708450334";        // Categoría privada Tickets Clientes (donde se crean los tickets)
const BACKUP_CATEGORY = "1378214859350478908";        // Categoría privada Tickets Respaldos (donde se guardan los respaldos)
const OWNER_ROLE = "1377110595475738847";
const SUPPORT_ROLE = "1377125235093930015";

// Para guardar mensaje de confirmación por usuario y borrarlo luego
const ticketReplies = new Map();

// Evento bienvenida (sin cambios)
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("#ffffff")
    .setAuthor({
      name: "ᶠᵏⁿ 𝕬𝖎𝖉𝖊𝖓",
      iconURL: "https://i.imgur.com/VtwQSns.png",
    })
    .setTitle("🔥✨ Bienvenido a tu nuevo estilo virtual")
    .setDescription(
      `> ✌️ ¡Hola <@${member.id}>! Bienvenido a **𝕬𝖎𝖉𝖊𝖓 𝕯𝖊𝖘𝖎𝖌𝖓**  
> 🔥 Ropa personalizada para **FiveM**.

╭───────────────╮  
**💎 Explora nuestras categorías:**  
🔹 <#1376071488779583548> – *Prendas exclusivas*  
🔹 <#1376071216619716708> – *Solicita tu diseño*  
🔹 <#1376071190136754196> – *Conoce las reglas*
╰───────────────╯  

📸 Mira ejemplos en el canal de <#1376071488779583548>.
      `
    )
    .setImage("https://i.imgur.com/tUVoa1o.png")
    .setFooter({
      text: "ᶠᵏⁿ 𝕬𝖎𝖉𝖊𝖓 – Diseño Exclusivo",
      iconURL: "https://i.imgur.com/VtwQSns.png",
    });

  channel.send({ embeds: [embed] });
});

// Ready: enviar mensaje con botón para abrir tickets en el canal #Tickets (1376071216619716708)
client.once("ready", async () => {
  console.log(`🟢 Bot activo como ${client.user.tag}`);

  const channel = await client.channels.fetch(TICKET_OPEN_CHANNEL);
  if (!channel) return console.log("Canal para botón tickets no encontrado.");

  // Evitar enviar el botón repetido si ya existe uno
  const fetchedMessages = await channel.messages.fetch({ limit: 10 });
  const hasButton = fetchedMessages.some(msg =>
    msg.components.length > 0 && 
    msg.components[0].components.some(btn => btn.customId === "abrir_ticket")
  );
  if (hasButton) return;

  const embed = new EmbedBuilder()
    .setColor("#ffffff")
    .setTitle("🎨 Solicita tu diseño personalizado")
    .setDescription(
      "Haz clic en el botón para abrir un ticket y contarnos lo que te gustaría diseñar."
    )
    .setFooter({ text: "ᶠᵏⁿ 𝕬𝖎𝖉𝖊𝖓 𝕯𝖊𝖘𝖎𝖌𝖓", iconURL: client.user.displayAvatarURL() });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("abrir_ticket")
      .setLabel("🎟️ Abrir Ticket")
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });
});

// Interacciones para abrir y cerrar tickets
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  // Abrir ticket
  if (interaction.customId === "abrir_ticket") {
    // Verificar si ya tiene ticket abierto en la categoría Tickets Clientes
    const existingChannel = interaction.guild.channels.cache.find(
      c => c.topic === interaction.user.id && c.parentId === TICKET_CATEGORY
    );
    if (existingChannel) {
      return interaction.reply({
        content: "❌ Ya tienes un ticket abierto.",
        ephemeral: true,
      });
    }

    // Crear canal nuevo en la categoría Tickets Clientes
    const channel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, ''),
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY,
      topic: interaction.user.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: OWNER_ROLE,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
        {
          id: SUPPORT_ROLE,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ],
    });

    const closeButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("cerrar_ticket")
        .setLabel("🗑️ Cerrar Ticket")
        .setStyle(ButtonStyle.Danger)
    );

    await channel.send({
      content: `<@${interaction.user.id}> ¡Gracias por contactarnos! Por favor, describe lo que te gustaría diseñar.`,
      components: [closeButton],
    });

    // Enviar confirmación al usuario y guardar para borrar después
    const replyMsg = await interaction.reply({
      content: `✅ Tu ticket ha sido creado: ${channel}`,
      ephemeral: true,
      fetchReply: true,
    });
    ticketReplies.set(interaction.user.id, replyMsg);
  }

  // Cerrar ticket
  if (interaction.customId === "cerrar_ticket") {
    const ticketUserId = interaction.channel.topic;
    if (!ticketUserId) return interaction.reply({ content: "No se pudo determinar el dueño del ticket.", ephemeral: true });

    const user = await interaction.guild.members.fetch(ticketUserId).catch(() => null);

    // Crear canal de respaldo en categoría Tickets Respaldos
    const backupChannel = await interaction.guild.channels.create({
      name: `respaldo-${interaction.channel.name}`,
      type: ChannelType.GuildText,
      parent: BACKUP_CATEGORY,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: OWNER_ROLE,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
        {
          id: SUPPORT_ROLE,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        }
      ]
    });

    let transcript = `📁 Transcripción de ${interaction.channel.name}:\n\n`;
    const messages = await interaction.channel.messages.fetch({ limit: 100 });
    const sorted = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sorted.values()) {
      transcript += `[${msg.createdAt.toLocaleString()}] ${msg.author.tag}: ${msg.content}\n`;
    }

    const filePath = path.join(__dirname, `${interaction.channel.name}.txt`);
    fs.writeFileSync(filePath, transcript);

    if (backupChannel.isTextBased()) {
      await backupChannel.send({
        content: `🗃️ Transcripción del ticket cerrado: **${interaction.channel.name}**`,
        files: [filePath],
      });
    }

    if (user) {
      await user
        .send({
          content: "🧾 Aquí tienes la transcripción de tu ticket:",
          files: [filePath],
        })
        .catch(() => console.log("No se pudo enviar DM al usuario."));
    }

    fs.unlinkSync(filePath);

    // Borrar mensaje de confirmación de creación de ticket
    if (ticketReplies.has(ticketUserId)) {
      const replyMsg = ticketReplies.get(ticketUserId);
      try {
        await replyMsg.delete();
      } catch (err) {
        console.log("No se pudo eliminar el mensaje de confirmación:", err);
      }
      ticketReplies.delete(ticketUserId);
    }

    await interaction.channel.delete();
  }
});

client.login(process.env.TOKEN);
