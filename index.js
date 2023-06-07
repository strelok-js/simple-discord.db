const fs = require('fs');
const yargs = require('yargs');
const { hideBin } = require('yargs/helpers');
const FS = fs.promises;
const path = require.main.path.replace(/\\/gmi, "/");

function generateOBJ(fun, objName) {
    const regExp = new RegExp(`:${objName}\.([^,^}]+)`,"g");
    const g = fun.toString().replace(/\n|\s/g,"").match(regExp).map(el=>el.replace(`:${objName}\.`,'').split("."));
    function getObject(arrays, obj={}) {
        for(const key of arrays) {
            if(key.length>1) {
                const keys = key.shift();
                obj[keys]=getObject([key],obj[keys]);
            } else obj[key[0]]="null {}";
        }
        return obj;
    }
    return getObject(g);
}
function isObject(object) { //Проверяет является ли что-то ну прям объектом
    if(
        Array.isArray(object) || 
        object === null ||
        typeof object !== 'object'
    ) return false;
    if(typeof object == 'object') return true;
}
function hide(obj,...keys) {
    for (const [key,value] of keys) {
        Object.defineProperty(obj, key, {
            enumerable : false,
            value
        });
    }
}

function _delete(copy, origin) { //Удаляет все ключи с "_"
    for (const key in origin) {
        if(key.slice(0,1) !== "_") {
            copy[key] = origin[key];
            if(isObject(origin[key])) _delete(copy[key], origin[key]);
        }
    }
}
function UpdateCreate(origin, data) { //Устанавливает ключи если их нет
    for (const key in data) {
        if(key.slice(0,1)!=="_") {
            if(origin[key] === undefined) origin[key] = data[key];
            else if(isObject(data[key]) && key!=="members") UpdateCreate(origin[key], data[key]);
        }
        
    }
}
function UpdateDelete(origin, data) { //Удаляет ключи если их быть не должно
    for (const key in origin) {
        if(key.slice(0,1)!=="_") {
            if(data[key] === undefined) delete origin[key];
            else if(isObject(origin[key]) && key!=="members") UpdateDelete(origin[key], data[key]);
        }

    }
}

const Default = {
    Schems: {
        guilds: guild=> {
            return {
                name: guild.name,
                owner: guild.ownerId,
                id: guild.id,
                members: {}
            };
        },
        members: member=> {
            return {
                id: member.id,
                username: member.user.username,
                guildId: member.guild.id
            };
        },
        users: user=>{
            return {
                id: user.id,
                username: user.username,
            };
        }
    }
};

const globals = {
    name: "ANY",
    bot: null,
};

class BaseManages {
    constructor(scheme, motherData, elementClass) {
        hide(this,["_scheme",scheme],["_elementClass",elementClass],["_motherData",motherData]);
    }
    [Symbol.iterator]() {
        this._iter = {
            Array: Object.values(this).filter(it=>it.id),
            current: 0
        };
        return this;
    } 
    next() {
        if (this._iter.current < this._iter.Array.length) {
            this._iter.current++;
            return { done: false, value: this._iter.Array[this._iter.current-1]};
        } else {
            return { done: true };
        }
    }
    get length() {
        return Object.values(this).filter(it=>it.id).length;
    }
    update() {
        for (const key in this) {
            if(key.slice(0,1) !== "_") {
                const element = this[key];
                for (let index = 0; index < arguments.length; index++) {
                    const keys = arguments[index];
                    if(element.cache) element[keys] = this._scheme(element.cache)[keys];
                }
            }	
        }
        return this;
    }
    get(id, clear = false) {
        if(clear && this[id]) return this[id].clearData;
        else return this[id]||null;
    }
    add(element) {
        return this.set(this._scheme(element));
    }
    set(element) {
        this[element.id] = new this._elementClass(element, this);
        return this[element.id];
    }
    get clearData() {
        const newThis = {};
        _delete(newThis, this);
        for (const key in newThis) 
            if(Object.hasOwnProperty.call(newThis, key)) newThis[key] = newThis[key].clearData;
        return newThis;
    }
}

class Base { //Это база, чел
    constructor(element, motherData) {
        for (const key in element) this[key] = element[key];
        hide(this,["_scheme",motherData._scheme]);
    }
    update() {
        for (let index = 0; index < arguments.length; index++) {
            const keys = arguments[index];
            this[keys] = this._scheme(this.cache)[keys];
        }
        return this;
    }
    get clearData() {
        const newThis = {};
        _delete(newThis, this);
        return newThis;
    }
}

class Memory {
    constructor(name = "DiscordDB", Client = null) {
        if(!name || typeof name !== "string") throw "Name not suitable";
        this.name = name;
        globals.bot = Client;
        globals.name = name;
        try {
            this._config = require(path+`/${this.name}/config.json`);
        } catch (err) {
            this._config = {
                autoAdd: false,
                noLaterBD: true,
                smartAutoAdd: false,
                backUp: {
                    enable: false,
                    time: 3600000,
                    count: 2
                },
                autoSave: {
                    enable: false,
                    lastRefresh: Date.now(),
                    time: 60000*10
                }
            };
        }
   
        if(this._config.autoSave.enable) this.setAutoSave();
        if(this._config.backUp.enable) this.setBackUp();
        if(this._config.autoAdd) {
            Client.on('messageCreate', message => {
                if(message.guild) {
                    if(!this.guilds.get(message.guild.id)) this.guilds.add(message.guild);
                    const memGuild = this.guilds.get(message.guild.id,false);
                    if(this._config.smartAutoAdd) for (const [id,member] of message.mentions.members) {
                        if(!memGuild.members.get(id)) memGuild.members.add(member);
                        if(!this.users.get(id)) this.users.add(member.user);
                    }
                    if(!memGuild.members.get(message.author.id)&&message.member) memGuild.members.add(message.member);
                    if(!this.users.get(message.author.id)&&message.author) this.users.add(message.author);
                }
            });
            Client.on('guildMemberAdd', member => {
                if(member.guild) {
                    if(!this.guilds.get(member.guild.id)) this.guilds.add(member.guild);
                    const memGuild = this.guilds.get(member.guild.id,false);
                    if(!memGuild.members.get(member.id)) memGuild.members.add(member);
                    if(!this.users.get(member.id)) this.users.add(member.user);
                }
            });
            Client.on("voiceStateUpdate", (oldState,newState)=>{
                if(oldState.member.guild) {
                    if(!this.guilds.get(oldState.member.guild.id)) this.guilds.add(oldState.member.guild);
                    const memGuild = this.guilds.get(oldState.member.guild.id,false);
                    if(!memGuild.members.get(oldState.member.id)) memGuild.members.add(oldState.member);
                    if(!this.users.get(oldState.member.id)) this.users.add(oldState.member.user);
                }
            })
        }
        if(!this._config.noLaterBD) {
            this.setAnyData();
            this.setGuilds();
            this.setUsers();
        }
    }
    console({clear}) {//!!
        let membersLength = 0;
        if(this.guilds) for (const key in this.guilds) {
            if(this.guilds[key].members) membersLength+=this.guilds[key].members.length;
        } 
        function colored(data, colored) {
            if(!clear) colored="";
            return colored+data+["","\x1b[0m"][+clear];
        }
        const def = {
            true: ["","\x1b[32mTrue\x1b[0m"][+clear],
            false: ["","\x1b[31mFalse\x1b[0m"][+clear]
        };
        const text = "" +
        ` ┍━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┑` + "\n"+
        ` ┝━━┥ Name DB:-------> ${colored(this.name,"\x1b[33m")}` + "\n"+
        ` ┝━━┥ Elements:------> \x1b[33m${colored((this.guilds?this.guilds.length:0)+membersLength+(this.users?this.users.length:0)+" count","\x1b[33m")}\x1b[0m` + "\n"+
        ` ┝━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┥` + "\n"+
        ` ┝━━┥ Guilds:--------> \x1b[33m${colored(this.guilds.length+" count","\x1b[33m")}` + "\n"+
        ` ┝━━┥ Members:-------> \x1b[33m${colored(membersLength+" count","\x1b[33m")}` + "\n"+
        ` ┝━━┥ Users:---------> \x1b[33m${colored(this.users.length+" count","\x1b[33m")}` + "\n"+
        ` ┝━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┥` + "\n"+
        ` ┝━━┥ BackUP: ${this._config.backUp.enable?def.true:def.false}` + "\n"+
        ` ┝━━┥ BackUP Time: ${colored(this._config.backUp.time,"\x1b[33m")}` + "\n"+
        ` ┝━━┥ BackUP Count: ${colored(this._config.backUp.count,"\x1b[33m")}` + "\n"+
        ` ┝━━┥ AutoSave: ${this._config.autoSave.enable?def.true:def.false}` + "\n"+
        ` ┝━━┥ AutoSave Time: ${colored(this._config.autoSave.time,"\x1b[33m")}` + "\n"+
        ` ┝━━┥ AutoAdd: ${this._config.autoAdd?def.true:def.false}` + "\n"+
        ` ┝━━┥ SmartAutoAdd: ${this._config.smartAutoAdd?def.true:def.false}` + "\n"+
       // ` ┝━━┥ Schems Guilds: ${this._config.guilds?"\x1b[32mEnabled\x1b[0m":"\x1b[31mNone\x1b[0m"}` + "\n"+
       // ` ┝━━┥ Schems Members: ${this._config.members?"\x1b[32mEnabled\x1b[0m":"\x1b[31mNone\x1b[0m"}` + "\n"+
       // ` ┝━━┥ Schems Users: ${this._config.users?"\x1b[32mEnabled\x1b[0m":"\x1b[31mNone\x1b[0m"}` + "\n"+
        ` ┕━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┙`;

        return text;
    }
    get clearData() {
        const newThis = {};
        _delete(newThis, this);
        if(newThis.guilds) {
            newThis.guilds = newThis.guilds.clearData;
            for (const key in newThis.guilds) {
                const guild = newThis.guilds[key];
                guild.members = this.guilds[key]._members.clearData;
            }
        }
        if(newThis.users) newThis.users = newThis.users.clearData;
        return newThis;
    }
    _backUp() {
        const time = Date.now(),
        data = {}, anyData = {};
        for (const key in this.clearData) {
            const element = this.clearData[key];
            if(["guilds", "users", "name"].includes(key)) data[key] = element;
            else anyData[key] = element;
        }
        FS.mkdir(`./${this.name}/_backUp/${time}`, {recursive: true}).then(()=>{
            FS.writeFile(`./${this.name}/_backUp/${time}/Memory.json`, JSON.stringify(data, null, '\t'));
            FS.writeFile(`./${this.name}/_backUp/${time}/AnyData.json`, JSON.stringify(anyData, null, '\t'));
            FS.writeFile(`./${this.name}/_backUp/${time}/config.json`, JSON.stringify(this._config, null, '\t'));
            fs.readdir(`./${this.name}/_backUp`, (err, files) => {
                const dirDellete = files.sort((a,b)=>a-b).slice(0,this._config.backUp.count*-1);
                for (const dir of dirDellete) fs.rmSync(`./${this.name}/_backUp/${dir}`, { recursive: true });
            });
        });
    }
    setBackUp() {
        clearInterval(this._IntervalBack);
        this._IntervalBack = setInterval(() => {
            this._backUp();
        }, this._config.backUp.time);
    }
    setAutoSave() {
        clearInterval(this._Interval);
        this._Interval = setInterval(() => {
            this.save();
        }, this._config.autoSave.time);
    }
    Discord(Discord) {
        const Memory = this;
        const {Guild, GuildMember, User} = Discord;

        Object.defineProperty(Guild.prototype, "memory", {
            get: function memory() {
                if(!Memory.guilds.get(this.id)&&Memory._config.smartAutoAdd) return Memory.guilds.add(this);
                return Memory.guilds.get(this.id);
            }
        });
        Object.defineProperty(GuildMember.prototype, "memory", {
            get: function memory() {
                const guild = this.guild.memory;
                if(!guild.members.get(this.id)&&Memory._config.smartAutoAdd) return guild.members.add(this);
                return guild.members.get(this.id);
            }
        });
        Object.defineProperty(User.prototype, "memory", {
            get: function memory() {
                if(!Memory.users.get(this.id)&&Memory._config.smartAutoAdd) return Memory.users.add(this);
                return Memory.users.get(this.id);
            }
        });
    }
    async create() {
        return new Promise(async (resolve, reject) => {
            const memoryData = {name: this.name, guilds: {}, users: {}},
            configData = {
                autoAdd: false,
                backUp: {
                    enable: false,
                    time: 3600000,
                    count: 2
                },
                autoSave: {
                    enable: false,
                    lastRefresh: Date.now(),
                    time: 60000*10
                }
            };
            await FS.mkdir(this.name).catch(reject);
            await FS.mkdir(this.name+"/Schems").catch(reject);
            const {guilds,users,members} = Default.Schems;

            await Promise.all([
                FS.writeFile(`./${this.name}/Memory.json`, JSON.stringify(memoryData, null, '\t')),
                FS.writeFile(`./${this.name}/AnyData.json`, JSON.stringify({}, null, '\t')),
                FS.writeFile(`./${this.name}/config.json`, JSON.stringify(configData, null, '\t')),
    
                FS.writeFile(`./${this.name}/Schems/guilds.js`, `module.exports = `+guilds.toString()),
                FS.writeFile(`./${this.name}/Schems/users.js`, `module.exports = `+users.toString()),
                FS.writeFile(`./${this.name}/Schems/members.js`, `module.exports = `+members.toString()),
            ]).catch(reject);

            this.setAnyData();
            this.setGuilds();
            this.setUsers();
            
            return resolve(this);
        });
    }
    save() {
        const {name,_config} = this,
        data = {}, anyData = {};
        const clearSaveData = this.clearData;
        for (const key in clearSaveData) {
            const element = clearSaveData[key];
            if(["guilds", "users", "name"].includes(key)) data[key] = element;
            else anyData[key] = element;
        }
        delete this._config.noLaterBD;
        this._config.autoSave.lastRefresh = Date.now();
        return new Promise((resolve, reject) => {
            fs.stat(`./${this.name}`, (err) => {
                if (!err) {
                    fs.writeFileSync(`./${name}/Memory.json`, JSON.stringify(data, null, '\t'));
                    fs.writeFileSync(`./${name}/AnyData.json`, JSON.stringify(anyData, null, '\t'));
                    fs.writeFileSync(`./${name}/config.json`, JSON.stringify(_config, null, '\t'));
    
                    resolve(true);
                } else if (err.code === 'ENOENT') {
                    reject("SDDB: No patch data!");
                } else reject("SDDB: Error writing file");
            });
        });
        
    }
    setAnyData() {
        return FS.stat(`./${this.name}/AnyData.json`)
        .then(stats=>{
            const AnyData = require(path+`/${this.name}/AnyData.json`);
            for (const key in AnyData) this[key] = AnyData[key];
        }).catch(err=>{
            console.error("\x1b[33mSDDB: WARN!\x1b[0m AnyData.json cannot be added to memory");
        });
    }
    setGuilds() {
        const MemGuilds = require(path+`/${this.name}/Memory.json`).guilds;
        const GuildsSchems = this._GuildsSchems = require(path+`/${this.name}/Schems/guilds.js`)||Default.Schems.guilds;
        GuildsSchems.default = generateOBJ(GuildsSchems, "guild"); 
        
        class Guilds extends BaseManages {
            set(element) {
                this[element.id] = new this._elementClass(element, this);
                this._motherData.setMembers(this[element.id]);
                return this[element.id];
            }
        }

        class Guild extends Base {
            set members(value) {
                this._members = value;
            }
            get members() {
                return this._members;
            }
            get clearData() {
                const newThis = {};
                _delete(newThis, this);
                newThis.members = this.members;
                return newThis;
            }
            fetch() {
                if(!globals.bot) return null;
                return globals.bot.guilds.fetch(this.id);
            }
            get cache() {
                if(!globals.bot) return null;
                return globals.bot.guilds.cache.get(this.id);
            }
        }

        this.guilds = new Guilds(GuildsSchems, this, Guild);
        const defaultGuild = GuildsSchems(GuildsSchems.default);
        for(let keys in MemGuilds) { //Обновлятель памяти
            const origin = MemGuilds[keys];
            UpdateCreate(origin, defaultGuild);
            UpdateDelete(origin, defaultGuild);
            this.guilds.set(origin);
        }
    }
    setUsers() {
        const MemUsers = require(path+`/${this.name}/Memory.json`).users;
        const UsersSchems = this._UsersSchems = require(path+`/${this.name}/Schems/users.js`)||Default.Schems.users;
        UsersSchems.default = generateOBJ(UsersSchems, "user");
            
        class Users extends BaseManages {}

        class User extends Base {
            fetch() {
                if(!globals.bot) return null;
                return globals.bot.users.fetch(this.id);
            }
            get cache() {
                if(!globals.bot) return null;
                return globals.bot.users.cache.get(this.id);
            }
        }

        if(!this.users) this.users = new Users(UsersSchems, this, User);
        const defaultGuild = UsersSchems(UsersSchems.default);
        for(let keys in MemUsers) { //Обновлятель памяти
            const origin = MemUsers[keys];
            UpdateCreate(origin, defaultGuild);
            UpdateDelete(origin, defaultGuild);
            this.users.set(origin);
        }
    }
    setMembers(guild) {
        const MembersSchems = this._MembersSchems = require(path+`/${this.name}/Schems/members.js`)||Default.Schems.members;
        MembersSchems.default = generateOBJ(MembersSchems, "member");

        class Members extends BaseManages {
            constructor(scheme, motherData, elementClass, This) {
                super(scheme, motherData, elementClass);
                hide(this,["_motherDataThis",This]);
            }
        }

        class Member extends Base {
            constructor(element, motherData) {
                super(element, motherData);
                hide(this,["_guildId",motherData._motherDataThis.id]);
            }
            fetch() {
                if(!globals.bot) return null;
                const guild = globals.bot.guilds.cache.get(this._guildId);
                if(guild && guild.available) return guild.members.fetch(this.id);
                else return null;
            }
            get cache() {
                if(!globals.bot) return null;
                const guild = globals.bot.guilds.cache.get(this._guildId);
                if(guild && guild.available) return guild.members.cache.get(this.id);
                else return null;
            }
        } 

        const member = MembersSchems(MembersSchems.default);
        if(guild) {
            const old = JSON.parse(JSON.stringify(guild._members));
            guild._members = new Members(MembersSchems, guild._members, Member, guild);
            for (const key in old) {
                const origin = old[key];
                UpdateCreate(origin, member);
                UpdateDelete(origin, member);
                guild._members.set(origin);	
            }
        }
    }
}

yargs(hideBin(process.argv))
.command('create [dbName]', 'Creates database files', (yargs) => {
    return yargs
    .positional('dbName', {
        describe: 'name of DB',
        default: 'DiscordDB'
    });
}, (argv) => {
    new Memory(argv.dbName).create()
    .then(el=>console.log(`A database named ${argv.dbName} has been created.`))
    .catch(el=>console.log('\033[31m Something went wrong. The database was not created.\n \033[0m'+el));
})
.parse();

module.exports = Memory;
