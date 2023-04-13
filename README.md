# Simple-discord.db
It is a simple library that can automatically save / check out / modify the saved data of the discord user.
The entire file structure is created in the root directory and stores guilds, users, members and other data in a separate file. 
## Usage 
Connect the library as 
```
const DiscordDB = require('simple-discord.db');
const Memory = new DiscordDB("name", Client);
```
To have access to it through the bot client. The `name` will determine which DB will be connected. Next, you should perform the initial configuration (performed once).
```
node node_modules/simple-discord.db create DiscordDB //To the console open in the project folder. DiscordDB - name of DB
//old method
await Memory.create(); //Creates initial files for memory 
```
All parameters of the database can be configured manually through the config in the folder of this database 
**Example:**
```
{
	autoAdd: true, //Auto add servers and users
	smartAutoAdd: true, //Smart adding users in the database
	backUp: {
		enable: false, //Backups included
		time: 3600000, //Every hour 
		count: 2 //Have at least 2 backups 
	},
	autoSave: {
		enable: true, //Autosave memory 
		lastRefresh: 1637793860575, //Last save time (Not setting)
		time: 1000*60 //Save interval 
	}
}
```
If you do not use `"autoAdd": true` you need to write manual addition.An example of adding used in db:
```
Client.on('messageCreate', message => {
	if(message.guild) {
		if(!Memory.guilds.get(message.guild.id)) Memory.guilds.add(message.guild);
		const memGuild = Memory.guilds.get(message.guild.id,false);
		if(!memGuild.members.get(message.author.id)&&message.member) memGuild.members.add(message.member);
		if(!Memory.users.get(message.author.id)&&message.author) Memory.users.add(message.author);
	}
});
```
Schemas are needed for this database. The simplest schemes are already automatically created in the memory folder. Their further changes are available when the schema file is changed.
**Guild Schema File:**
```
module.exports = guild => {
    return  {
        "name": guild.name,
        "owner": guild.ownerId,
        "id": guild.id,
        "members": {}
    };
};
```
As a guild must have `members`, `members` must have a `guildId` inside for memory to work. 
These sections of memory can be accessed as `Memory.guilds.get(id)`. In response, you receive data about the `guild`. 
The guild itself, like all data inside the memory, has the following keys: 
```
const guild = Memory.guilds.get("899200433552252989");
guild.clearData; //Retrieves a copy of the guild data 
//or
Memory.guilds.clearData; //Retrieves a copy of all guild data in memory 
guild.cache; //Gets this guild's discord cache 
guild.add(message.guild) //Manual Adding Guild to Memory
await guild.fetch(); //Searches for this guild in discord
guild.update(key); //Refreshes / resets a specific tuning key to the default (specified by the schema) 
//or
Memory.guilds.update(key); //Refreshes / resets a specific key for all guilds in memory 
```
## Integration into classes Discord.js
The library can be integrated inside Discord classes.js for easier and more convenient data acquisition.
**This is done as:**
```
const {Client, Guild, GuildMember, User} = require('discord.js');
const DiscordDB = require('simple-discord.db');

const bot = new Client(config.cfg);
const Memory = new DiscordDB("DiscordDB", bot);
Memory.Discord({Guild, GuildMember, User});
```
After that, it becomes possible to easily retrieve data from the DB.
**Example:**
```
const {member, author, guild} = message/interaction;
guild.memory === Memory.guilds.get(guild.id); //true
member.memory === Memory.guilds.get(guild.id).members.get(member.id); //true
author.memory === Memory.users.get(author.id); //true
```
At the same time, if the smartAutoAdd parameter is activated and the sample is not in the DB, it will be created.
## More details
You can output settings data to the console via `Memory.console()`, but if you want to output data not to the console, but in a simple text format, use `Memory.console({clear: true})`.

## Iterator
You can always call enumeration functions on `guilds`, `users` and `members` objects. 
Returns the actual value of the content.
```
for (const iterator of Memory.guilds) {
	console.log(iterator);
}
```