// roguelike - Phaser.js Game
// Tone.js music generator included via CDN in index.html

const TILE = 32;
const DUNGEON_W = 40;
const DUNGEON_H = 25;

function generateDungeon(w, h) {
    const map = Array.from({length:h},()=>Array(w).fill(1));
    const rooms = [];
    function carve(x,y,w,h){
        for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)map[j][i]=0;
    }
    for(let tries=0;tries<200;tries++){
        const rw = Phaser.Math.Between(4,9);
        const rh = Phaser.Math.Between(4,9);
        const rx = Phaser.Math.Between(1,w-rw-1);
        const ry = Phaser.Math.Between(1,h-rh-1);
        const overlap = rooms.some(r=>rx<r.x+r.w+1&&rx+rw+1>r.x&&ry<r.y+r.h+1&&ry+rh+1>r.y);
        if(!overlap){
            rooms.push({x:rx,y:ry,w:rw,h:rh});
            carve(rx,ry,rw,rh);
        }
    }
    for(let i=1;i<rooms.length;i++){
        const a = rooms[i-1];
        const b = rooms[i];
        if(Phaser.Math.Between(0,1)===0){
            for(let x=Math.min(a.x,b.x);x<=Math.max(a.x+a.w,b.x+b.w);x++)map[a.y+Math.floor(a.h/2)][x]=0;
            for(let y=Math.min(a.y,b.y);y<=Math.max(a.y+a.h,b.y+b.h);y++)map[y][b.x+Math.floor(b.w/2)]=0;
        }else{
            for(let y=Math.min(a.y,b.y);y<=Math.max(a.y+a.h,b.y+b.h);y++)map[a.y+Math.floor(a.h/2)][y]=0;
            for(let x=Math.min(a.x,b.x);x<=Math.max(a.x+a.w,b.x+b.w);x++)map[b.y+Math.floor(b.h/2)][x]=0;
        }
    }
    return {map,rooms};
}

class MainScene extends Phaser.Scene {
    constructor() {
        super({key:'MainScene'});
        this.level = 1;
        this.score = 0;
        this.musicStarted = false;
    }
    preload(){
        this.make.graphics({x:0,y:0,add:false})
            .fillStyle(0xff00ff).fillRect(0,0,TILE,TILE).generateTexture('wall',TILE,TILE);
        this.make.graphics({x:0,y:0,add:false})
            .fillStyle(0x00ffff).fillRect(0,0,TILE,TILE).generateTexture('floor',TILE,TILE);
        this.make.graphics({x:0,y:0,add:false})
            .fillStyle(0xffd700).fillRect(0,0,TILE,TILE).generateTexture('player',TILE,TILE);
        this.make.graphics({x:0,y:0,add:false})
            .fillStyle(0xff5555).fillRect(0,0,TILE,TILE).generateTexture('enemy',TILE,TILE);
        this.make.graphics({x:0,y:0,add:false})
            .fillStyle(0x00ff00).fillRect(0,0,TILE,TILE).generateTexture('potion',TILE,TILE);
        this.make.graphics({x:0,y:0,add:false})
            .fillStyle(0xff6ec7).fillRect(0,0,TILE,TILE).generateTexture('stairs',TILE,TILE);
    }
    create(){
        this.cameras.main.setBackgroundColor('#0f0f23');
        this.cameras.main.setZoom(1.5);
        this.input.keyboard.on('keydown-R',()=>this.scene.restart());
        this.buildLevel();
        this.createMusic();
    }
    createMusic(){
        if(this.musicStarted)return;
        this.musicStarted=true;
        if(typeof Tone==='undefined')return;
        const synth = new Tone.PolySynth(Tone.FMSynth).toDestination();
        const bass = new Tone.MonoSynth({oscillator:{type:"sine"},envelope:{attack:0.1,release:0.5}}).toDestination();
        const noise = new Tone.Noise("pink").toDestination();
        const noiseVol = new Tone.Volume(-30).connect(noise);
        const pattern = ["C3","Eb3","G3","Bb3"];
        const bassPattern = ["C2","C2","G2","C2"];
        let step=0;
        const loop = new Tone.Loop((time)=>{
            const chord = [pattern[step%4]+"4",pattern[(step+2)%4]+"5"];
            synth.triggerAttackRelease(chord,"8n",time,0.2);
            bass.triggerAttackRelease(bassPattern[step%4],"8n",time,0.4);
            if(step%8===0)noiseVol.volume.value=-20;
            else noiseVol.volume.value=-30;
            step++;
       },"4n");
        Tone.Transport.bpm.value=100;
        Tone.Transport.start();
        loop.start(0);
    }
    buildLevel(){
        this.dungeon = generateDungeon(DUNGEON_W,DUNGEON_H);
        if(this.walls)this.walls.clear(true,true);
        if(this.floors)this.floors.clear(true,true);
        this.walls = this.add.group();
        this.floors = this.add.group();
        const map = this.dungeon.map;
        for(let y=0;y<DUNGEON_H;y++){
            for(let x=0;x<DUNGEON_W;x++){
                const tile = map[y][x];
                const sprite = this.add.sprite(x*TILE,y*TILE,tile?'wall':'floor');
                sprite.setTint(tile?0x6a0dad:0x1a1a3a);
                (tile?this.walls:this.floors).add(sprite);
            }
        }
        const start = this.dungeon.rooms[0];
        if(!this.player){
            this.player = this.add.sprite((start.x+Math.floor(start.w/2))*TILE,(start.y+Math.floor(start.h/2))*TILE,'player');
            this.cameras.main.startFollow(this.player,true,1,1);
        }else{
            this.player.setPosition((start.x+Math.floor(start.w/2))*TILE,(start.y+Math.floor(start.h/2))*TILE);
        }
        this.player.hp = this.player.hp||10;
        this.player.maxHp = this.player.maxHp||10;
        this.player.atk = 3;
        if(this.enemies)this.enemies.clear(true,true);
        this.enemies = this.add.group();
        for(let i=1;i<this.dungeon.rooms.length;i++){
            const r = this.dungeon.rooms[i];
            const enemy = this.add.sprite((r.x+Math.floor(r.w/2))*TILE,(r.y+Math.floor(r.h/2))*TILE,'enemy');
            enemy.hp = 3+this.level;
            enemy.atk = 1+Math.floor(this.level/2);
            enemy.setTint(0xff5555);
            this.enemies.add(enemy);
        }
        if(this.potions)this.potions.clear(true,true);
        this.potions = this.add.group();
        for(let i=0;i<3+this.level;i++){
            const r = Phaser.Math.RND.pick(this.dungeon.rooms);
            const potion = this.add.sprite((r.x+Phaser.Math.Between(1,r.w-1))*TILE,(r.y+Phaser.Math.Between(1,r.h-1))*TILE,'potion');
            potion.setTint(0x00ff99);
            this.potions.add(potion);
        }
        const last = this.dungeon.rooms[this.dungeon.rooms.length-1];
        this.stairs = this.add.sprite((last.x+Math.floor(last.w/2))*TILE,(last.y+Math.floor(last.h/2))*TILE,'stairs');
        this.stairs.setTint(0xff6ec7);
        this.createUI();
    }
    createUI(){
        if(this.ui)this.ui.forEach(u=>u.destroy());
        this.ui=[];
        const style = {fontSize:'16px',fill:'#ffffff',fontFamily:'monospace'};
        this.ui.push(this.add.text(16,16,'Level: '+this.level,style).setScrollFactor(0));
        this.ui.push(this.add.text(16,40,'HP: '+this.player.hp+'/'+this.player.maxHp,style).setScrollFactor(0));
        this.ui.push(this.add.text(16,64,'Score: '+this.score,style).setScrollFactor(0));
        this.ui.push(this.add.text(16,600-32,'[R] Restart  [Arrows] Move',style).setScrollFactor(0));
    }
    update(){
        const cursors = this.input.keyboard.createCursorKeys();
        const wasd = this.input.keyboard.addKeys('W,S,A,D');
        const dir = {x:0,y:0};
        if(cursors.left.isDown||wasd.A.isDown)dir.x=-1;
        if(cursors.right.isDown||wasd.D.isDown)dir.x=1;
        if(cursors.up.isDown||wasd.W.isDown)dir.y=-1;
        if(cursors.down.isDown||wasd.S.isDown)dir.y=1;
        if(dir.x||dir.y){
            if(this.tryMove(this.player,dir.x,dir.y))this.enemyTurn();
        }
    }
    tryMove(entity,dx,dy){
        const tx = Math.floor((entity.x+dx*TILE)/TILE);
        const ty = Math.floor((entity.y+dy*TILE)/TILE);
        if(this.dungeon.map[ty][tx]===1)return false;
        entity.x+=dx*TILE;
        entity.y+=dy*TILE;
        if(entity===this.player){
            this.potions.children.entries.forEach(p=>{
                if(Math.floor(p.x/TILE)===tx&&Math.floor(p.y/TILE)===ty){
                    this.player.hp=Math.min(this.player.hp+3,this.player.maxHp);
                    p.destroy();
                    this.createUI();
                }
            });
            if(Math.floor(this.stairs.x/TILE)===tx&&Math.floor(this.stairs.y/TILE)===ty){
                this.level++;
                this.score+=100;
                this.buildLevel();
            }
        }
        return true;
    }
    enemyTurn(){
        this.enemies.children.entries.forEach(e=>{
            const dx = Math.sign(this.player.x-e.x);
            const dy = Math.sign(this.player.y-e.y);
            const dist = Math.abs(this.player.x-e.x)+Math.abs(this.player.y-e.y);
            if(dist<TILE*5){
                if(dist<TILE*2){
                    this.player.hp-=e.atk;
                    this.cameras.main.shake(100,0.01);
                    if(this.player.hp<=0){
                        this.add.text(400,300,'GAME OVER',{fontSize:'48px',fill:'#ff0000'}).setOrigin(0.5);
                        this.scene.pause();
                    }
                    this.createUI();
                }else{
                    this.tryMove(e,dx,0)||this.tryMove(e,0,dy);
                }
            }
        });
    }
}

window.onload = () => {
    const config = {
        type:Phaser.AUTO,
        width:800,height:600,
        parent:'game-container',
        backgroundColor:'#0f0f23',
        render:{pixelArt:true},
        scene:MainScene
    };
    window.game = new Phaser.Game(config);
};