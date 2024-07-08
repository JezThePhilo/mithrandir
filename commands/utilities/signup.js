const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const Configs = require('../../models/configs').getModel();
const Signups = require('../../models/signups').getModel();
const SignupOptions = require('../../models/signupoptions').getModel();
const SignupResponses = require('../../models/signupresponses').getModel();
const SignupAttachments = require('../../models/signupattachments').getModel();
const { Op } = require('sequelize');

/* Signups.hasMany(SignupResponses, {
    foreignKey: {
        name: 'signupId'
    }
});
Signups.hasMany(SignupAttachments, {
    foreignKey: {
        name: 'signupId'
    }
});

SignupResponses.belongsTo(Signups);
SignupResponses.hasOne(SignupOptions);

SignupAttachments.belongsTo(Signups);
SignupAttachments.hasOne(SignupOptions);

SignupOptions.belongsTo(SignupAttachments);
SignupOptions.belongsTo(SignupResponses); */


module.exports = {
	data: new SlashCommandBuilder()
		.setName('signup')
		.setDescription('Manage Signups, aka Events.')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.CreateEvents)
        .addSubcommand(scCreate => 
            scCreate
                .setName('create')
                .setDescription('Create a new Signup')
                .addChannelOption(scCreateChannelOpt => 
                    scCreateChannelOpt
                        .setName('channel')
                        .setDescription('The channel to send the signup to')
                        .setRequired(true)
                )
                .addStringOption(scCreateTitleOpt => 
                    scCreateTitleOpt
                        .setName('title')
                        .setDescription('The signup title')
                        .setRequired(true)
                )
                .addStringOption(scCreateDescriptionOpt => 
                    scCreateDescriptionOpt
                        .setName('description')
                        .setDescription('The signup description')
                        .setRequired(true)
                )
                .addStringOption(scCreateStartTimeOpt => 
                    scCreateStartTimeOpt
                        .setName('start')
                        .setDescription('End time in UTC (Format: YYYY-MM-DDTHH:MM)')
                        .setRequired(true)
                )
                .addStringOption(scCreateStartTimeOpt => 
                    scCreateStartTimeOpt
                        .setName('end')
                        .setDescription('End time in UTC (Format: YYYY-MM-DDTHH:MM)')
                        .setRequired(true)
                )
                .addRoleOption(scCreateNotifyRoleOpt => 
                    scCreateNotifyRoleOpt
                        .setName('notify-role')
                        .setDescription('Role to ping on Signup message post')
                )
        )
        .addSubcommandGroup(scgOptions => 
            scgOptions
                .setName('options')
                .setDescription('Manage and attach signup Options')
                .addSubcommand(scOptionsList => 
                    scOptionsList
                        .setName('list')
                        .setDescription('List all available options on this server')
                )
                .addSubcommand(scOptionsCreate => 
                    scOptionsCreate
                        .setName('create')
                        .setDescription('Create a new option')
                        .addStringOption(scOptionsCreateText => 
                            scOptionsCreateText
                                .setName('text')
                                .setDescription('Text to display for this option')
                                .setRequired(true)
                        ).addStringOption(scOptionsCreateEmoji => 
                            scOptionsCreateEmoji
                                .setName('emoji')
                                .setDescription('Optional emoji for this option')
                        )
                )
                .addSubcommand(scOptionsDelete => 
                    scOptionsDelete
                        .setName('delete')
                        .setDescription('Delete an option')
                        .addIntegerOption(scOptionsDeleteID => 
                            scOptionsDeleteID
                                .setName('option-id')
                                .setDescription('ID of the option to delete')
                                .setRequired(true)
                        )
                )
                .addSubcommand(scOptionsAttach => 
                    scOptionsAttach
                        .setName('attach')
                        .setDescription('Add the option to a Signup embed')
                        .addStringOption(scOptionsAttachMessageId => 
                            scOptionsAttachMessageId
                                .setName('signup-id')
                                .setDescription('The message ID of the signup embed')
                                .setRequired(true)
                        )
                        .addIntegerOption(scOptionsAttachOptionId => 
                            scOptionsAttachOptionId
                                .setName('option-id')
                                .setDescription('The option ID to add')
                                .setRequired(true)
                        )
                        .addIntegerOption(scOptionsAttachMaxValue => 
                            scOptionsAttachMaxValue
                                .setName('max-allowed')
                                .setDescription('Optional max users allowed for this option')
                        )
                )
        ),
	async execute(interaction) {
        const config = await Configs.findOne({where: {guildId: interaction.guild.id}});
        var subCommand = interaction.options.getSubcommand();
        var subCommandGroup = interaction.options.getSubcommandGroup();
        if(!subCommandGroup && subCommand === 'create'){
            const tgtChannel = interaction.options.getChannel('channel');
            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const start = interaction.options.getString('start');
            const end = interaction.options.getString('end');
            const pingRole = interaction.options.getRole('notify-role');

            const embed = new EmbedBuilder()
                .setAuthor({iconURL: interaction.member.avatarURL()? interaction.member.avatarURL(): interaction.user.avatarURL(), name: interaction.user.username})
                .setTitle(title)
                .setDescription(description)
                .setColor('00bdf7')
                .addFields({name: 'Time', value: `${start} - ${end}`});
            var emMsg;
            if(pingRole){
                emMsg = await tgtChannel.send({content: `${pingRole}`, embeds: [embed]});
            }else{
                emMsg = await tgtChannel.send({embeds: [embed]});
            }
            const createSignup = await Signups.create({
                id: emMsg.id,
                guildId: interaction.guild.id,
                title: title,
                description: description,
                startTimestamp: start,
                endTimestamp: end,
                channelId: emMsg.channelId
            });
            await createSignup.save();
            await interaction.reply(`Created signup for event successfully.`);
        }else if(subCommandGroup === "options"){
            if(subCommand === 'list'){
                //TODO: update with emoji setting
                const options = await SignupOptions.findAll({where: {guildId: interaction.guild.id}});
                if(options.length == 0){
                    await interaction.reply(`No options have been created for this Guild.`);
                }else{
                    var optList = [];
                    for(var opt in options){
                        optList.push(`${options[opt].id}: ${options[opt].text}`);
                    }
                    const embed = new EmbedBuilder()
                        .setTitle(`List of options in this Guild`)
                        .setDescription(optList.join(`\n`));
                    await interaction.reply({embeds: [embed]});
                }
            }else if(subCommand === 'create'){
                const text = interaction.options.getString(`text`);
                const emojiText = interaction.options.getString("emoji");

                if(emojiText){
                    try{
                        var emoji = await interaction.client.emojis.resolveIdentifier(emojiText);
                        if(emoji.indexOf('%3A') != -1){
                            emoji = emoji.split('%3A')[1];
                        }
                        const newOption = await SignupOptions.create({
                            guildId: interaction.guild.id,
                            text: text,
                            emoji: emoji
                        });
                        await newOption.save();
                        await interaction.reply(`Created option (ID: ${newOption.id}) successfully`);
                    }catch(err){
                        await interaction.reply("Could not find an emoji with that identifier. Please make sure the emoji provided is the only text in the `Emoji` field, and that the bot is on the server that that Emoji belongs to.");
                    }
                }else{
                    const newOption = await SignupOptions.create({
                        guildId: interaction.guild.id,
                        text: text
                    });
                    await newOption.save();
                    await interaction.reply(`Created option (ID: ${newOption.id}) successfully`);
                }
            }else if(subCommand === 'delete'){
                const optionId = interaction.options.getInteger('option-id');
                const options = await SignupOptions.findOne({where: {[Op.and]: [{guildId: interaction.guild.id}, {id: optionId}]}});
                if(options){
                    options.destroy().then(async () => {
                        await interaction.reply(`Deleted option with ID ${optionId} successfully.`);
                    }).catch(async err => {
                        if(err.original.errno == 19){
                            await interaction.reply(`That option cannot be deleted as it has been used on a previous signup.`);
                        }else{
                            await interaction.reply(`An error occurred while deleting that option. Please try again later.`);
                        }
                        console.error(err);
                    });
                }else{
                    await interaction.reply(`No such option with ID ${optionId} exists in this Guild.`);
                }
            }else if(subCommand === 'attach'){
                const signupId = interaction.options.getString('signup-id');
                const optionId = interaction.options.getInteger('option-id');
                const maxAllowed = interaction.options.getInteger('max-allowed');
                const attachment = await SignupAttachments.findOne({where: {[Op.and]: [{signupId: signupId},{optionId: optionId}]}, include: {all: true}});
                const signup = await Signups.findOne({where: {[Op.and]: [{guildId: interaction.guild.id},{id: signupId}]}});
                const option = await SignupOptions.findOne({where: {[Op.and]: [{guildId: interaction.guild.id},{id: optionId}]}});
    
                if(attachment){
                    await interaction.reply(`That option already exists on that signup and cannot be used again.`);
                }else{
                    if(signup){
                        if(option){
                            // Get rows, calculate if new row needed, add row if needed, add button to row, write position to DB, respond
                            var signupMessageChannel = await interaction.guild.channels.fetch(signup.channelId);
                            var signupMessage = await signupMessageChannel.messages.fetch(signup.id);
                            var allActionRows = signupMessage.components;
                            var actionRow;
                            var newOptionButton = new ButtonBuilder()
                                .setCustomId(`signupOption-${optionId}`)
                                .setLabel(`${option.text}`)
                                .setStyle(ButtonStyle.Primary);
                            if(option.emoji){
                                newOptionButton.setEmoji(option.emoji);
                            }
                            if(allActionRows.length != 0 && allActionRows[allActionRows.length - 1].components.length < 5){
                                allActionRows[allActionRows.length - 1] = ActionRowBuilder
                                    .from(allActionRows[allActionRows.length - 1].toJSON())
                                    .addComponents(newOptionButton);
                            }else{
                                actionRow = new ActionRowBuilder()
                                    .addComponents(newOptionButton);
                                allActionRows.push(actionRow);
                            }
                            signupMessage.edit({components: allActionRows}).then(msg => {
                                //console.log(signupMessage);
                                if(maxAllowed){
                                    SignupAttachments.create({
                                        signupId: signupId,
                                        optionId: optionId,
                                        maxAllowed: maxAllowed
                                    }).then(() => {
                                        interaction.reply({content: `Added option successfully`, ephemeral: true});
                                    }).catch(err => {
                                        console.error(err);
                                        interaction.reply({content: `Failed to add option`, ephemeral: true});
                                    });
                                }else{
                                    SignupAttachments.create({
                                        signupId: signupId,
                                        optionId: optionId
                                    }).then(() => {
                                        interaction.reply({content: `Added option successfully`, ephemeral: true});
                                    }).catch(err => {
                                        console.error(err);
                                        interaction.reply({content: `Failed to add option`, ephemeral: true});
                                    });
                                }
                            }).catch(err => {
                                console.error(err);
                                interaction.reply({content: `Failed to add option`, ephemeral: true});
                            });
                        }else{
                            await interaction.reply(`No option with that ID exists in this guild.`);
                        }
                    }else{
                        await interaction.reply(`No signup with that ID exists in this guild.`);
                    }
                }
            }
        }
	},
};
