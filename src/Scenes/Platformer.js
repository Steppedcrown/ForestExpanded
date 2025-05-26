class Platformer extends Phaser.Scene {
    constructor() {
        super("level1");
    }

    init() {
        // variables and settings
        this.ACCELERATION = 500;
        this.DRAG = 6 * this.ACCELERATION;    // DRAG < ACCELERATION = icy slide
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -500;
        this.PARTICLE_VELOCITY = 50;
        this.SCALE = 2.0;
        this.MAX_VELOCITY = 300; // max speed

        this.isGameOver = false;
        this.wasGrounded = false;
        this.inputLocked = false;
        this.spawnPoint = [75, 245]; // default spawn point
        //this.spawnPoint = [1200, 0]; // end spawn point
        this.coyoteTime = 0;
        this.COYOTE_DURATION = 100; // milliseconds of grace period
        this.jumpBufferRemaining = 0;
        this.hasJumped = false; // flag to check if the player has jumped
        this.JUMP_BUFFER_DURATION = 100; // milliseconds to buffer a jump input
        this.JUMP_CUTOFF_VELOCITY = -200;  // Control how "short" a short hop is
        this.UI_DEPTH = 99; // UI depth for buttons and text
        this.walkStepCooldown = 0;
        this.STEP_INTERVAL = 200; // ms between steps

    }

    preload() {
        this.load.scenePlugin('AnimatedTiles', './lib/AnimatedTiles.js', 'animatedTiles', 'animatedTiles');
    }

    create() {
        // Create a new tilemap game object
        this.map = this.add.tilemap("platformer-level-1", 18, 18, 80, 20);

        // Add a tileset to the map
        // First parameter: name we gave the tileset in Tiled
        // Second parameter: key for the tilesheet (from this.load.image in Load.js)
        this.tileset = this.map.addTilesetImage("kenny_tilemap_packed", "tilemap_tiles");

        // Create layers
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.undergroundLayer = this.map.createLayer("Underground", this.tileset, 0, 0);
        this.detailLayer = this.map.createLayer("Details", this.tileset, 0, 0);
        this.waterfallLayer = this.map.createLayer("Waterfalls", this.tileset, 0, 0);

        // Order the layers
        this.groundLayer.setDepth(-1);
        this.undergroundLayer.setDepth(-3);
        this.detailLayer.setDepth(-2);
        this.waterfallLayer.setDepth(2);

        // Enable animated tiles
        this.animatedTiles.init(this.map);

        // Make it collidable
        this.groundLayer.setCollisionByProperty({
            collides: true
        });

        // set up player avatar
        my.sprite.player = this.physics.add.sprite(this.spawnPoint[0], this.spawnPoint[1], "platformer_characters", "tile_0000.png");
        my.sprite.player.setFlip(true, false); // face right
        my.sprite.player.setMaxVelocity(this.MAX_VELOCITY, 1500); // max speed
        my.sprite.player.body.setSize(14, 16).setOffset(6, 6);
        my.sprite.player.setDepth(1);
        my.sprite.player.setOrigin(0.5, 1); // Origin to center bottom


        // Bounds
        this.physics.world.setBounds(0, -0, this.map.widthInPixels, this.map.heightInPixels);
        this.physics.world.setBoundsCollision(true, true, true, false);  // left, right, top, bottom
        my.sprite.player.setCollideWorldBounds(true);
        this.lastSafePosition = this.spawnPoint;

        // Bounds
        this.physics.world.setBoundsCollision(true, true, true, false);  // left, right, top, bottom
        my.sprite.player.setCollideWorldBounds(true);
        this.lastSafePosition = this.spawnPoint;


        // Enable collision handling
        this.physics.add.collider(my.sprite.player, this.groundLayer);

        // Add camera
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.1, 0.1); // (target, [,roundPixels][,lerpX][,lerpY])
        this.cameras.main.setDeadzone(20, 20);
        this.cameras.main.setZoom(this.SCALE);
        // Set the background color
        const bgColor = this.cache.tilemap.get("platformer-level-1").data.backgroundcolor;
        if (bgColor) this.cameras.main.setBackgroundColor(bgColor);

        this.addButtons();
        this.setupScore();
        this.addObjects();

        // Store audio
        this.walkSound = this.sound.add('walkSound', {
            loop: true
        }); 
        this.jumpSound = this.sound.add('jumpSound', {
            volume: 0.25,
            loop: false
        });
        this.levelCompleteSound = this.sound.add('levelCompleteSound', {
            volume: 0.5,
            loop: false
        });
        this.backgroundMusic = this.sound.add('bgMusic', {
            volume: 0.4,
            loop: true
        });

        // Input handling
        cursors = this.input.keyboard.createCursorKeys();
        this.dKey = this.input.keyboard.addKey('D');
        this.aKey = this.input.keyboard.addKey('A');
        this.spaceKey = this.input.keyboard.addKey('SPACE');

        // Movement vfx
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_03.png', 'smoke_09.png'],
            random: true,
            scale: {start: 0.03, end: 0.05},
            maxAliveParticles: 3,
            lifespan: 250,
            gravityY: -50,
            duration: 500,
            alpha: {start: 1, end: 0.25}, 
        });
        my.vfx.walking.stop();

        // Jumping vfx
        my.vfx.jumping = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_10.png'],
            scale: {start: 0.03, end: 0.07},
            maxAliveParticles: 1,
            lifespan: 200,
            gravityY: -50,
            duration: 1,
            alpha: {start: 1, end: 0.4}
        });
        my.vfx.jumping.setDepth(2); // Ensure it appears above the player
        my.vfx.jumping.stop();

        // Landing vfx
        my.vfx.landing = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_10.png'],
            scale: {start: 0.03, end: 0.06},
            maxAliveParticles: 1,
            lifespan: 200,
            gravityY: -50,
            duration: 1,
            alpha: {start: 1, end: 0.4}
        });
        my.vfx.landing.setDepth(2); // Ensure it appears above the player
        my.vfx.landing.stop();

        // Collect vfx
        my.vfx.collect = this.add.particles(0, 0, "kenny-particles", {
            frame: ['star_08.png'],
            scale: {start: 0.03, end: 0.06},
            maxAliveParticles: 1,
            lifespan: 1000,
            gravityY: -50,
            duration: 1,
            alpha: {start: 0.8, end: 0.25}
        });
        my.vfx.collect.setDepth(10); // Ensure it appears behind the player
        my.vfx.collect.stop();

        // Bubbles
        this.createBubbles(150, 240, 315, 375);
        this.createBubbles(1050, 1270, 370, 375);
        this.createBubbles(1275, 1375, 305, 375);

        // Reset browser cache
        this.input.keyboard.on('keydown-P', (event) => {
            localStorage.setItem('highScore', 0);
        }, this);

        // Start background music
        let bgMusic = this.registry.get('bgMusic') || false;
        this.registry.set('bgMusic', bgMusic); // Set if music is playing
        if (!bgMusic) {
            this.backgroundMusic.play();
            this.registry.set('bgMusic', true); // Set music is playing
        }
    }

    update(time, delta) {
        const groundedNow = my.sprite.player.body.blocked.down;
        let isWalking = false;

        if (!this.inputLocked) {
            if(cursors.left.isDown || this.aKey.isDown) {
                if (my.sprite.player.body.velocity.x > 0) my.sprite.player.setVelocityX(my.sprite.player.body.velocity.x / 4);
                my.sprite.player.setAccelerationX(-this.ACCELERATION);
                my.sprite.player.resetFlip();
                my.sprite.player.anims.play('walk', true);
                // Particle following
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-10, my.sprite.player.displayHeight/2-15, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                } 
                isWalking = true;

            } else if(cursors.right.isDown || this.dKey.isDown) {
                if (my.sprite.player.body.velocity.x < 0) my.sprite.player.setVelocityX(my.sprite.player.body.velocity.x / 4);
                my.sprite.player.setAccelerationX(this.ACCELERATION);
                my.sprite.player.setFlip(true, false);
                my.sprite.player.anims.play('walk', true);
                // Particle following
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth/2-10, my.sprite.player.displayHeight/2-15, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                // Only play smoke effect if touching the ground
                if (my.sprite.player.body.blocked.down) {
                    my.vfx.walking.start();
                }
                isWalking = true;

            } else {
                // Set acceleration to 0 and have DRAG take over
                my.sprite.player.setAccelerationX(0);
                my.sprite.player.setDragX(this.DRAG);
                //my.sprite.player.setVelocityX(0); // stop horizontal movement
                my.sprite.player.anims.play('idle');
                my.vfx.walking.stop();
            } 
        } else {
            // Set acceleration to 0 and have DRAG take over
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setDragX(this.DRAG);
            //my.sprite.player.setVelocityX(0); // stop horizontal movement
            my.sprite.player.anims.play('idle');
            my.vfx.walking.stop();
        }

        // Movement sfx
        this.walkStepCooldown -= delta;
        if (isWalking && groundedNow) {
            if (this.walkStepCooldown <= 0) {
                // Reset cooldown
                this.walkStepCooldown = this.STEP_INTERVAL;

                // Restart sound
                this.walkSound.stop(); // reset if already playing
                this.walkSound.play();

                // Reset volume to 0 and tween it in and out
                this.walkSound.setVolume(0.35);

                this.tweens.add({
                    targets: this.walkSound,
                    volume: 0,
                    duration: 300,
                    ease: 'Sine.easeInOut'
                });
            }
        }

        // Lean affect
        const velocityX = my.sprite.player.body.velocity.x;
        const maxLeanAngle = 10; // degrees to lean at full speed
        const maxSquash = 0.9;   // horizontal squash factor

        // Normalize velocity to [-1, 1] based on max speed
        const speedRatio = Phaser.Math.Clamp(velocityX / this.MAX_VELOCITY, -1, 1);

        // Lean the player
        my.sprite.player.setRotation(Phaser.Math.DegToRad(maxLeanAngle * speedRatio));

        // Slight horizontal squash (increase scaleX when leaning)
        my.sprite.player.setScale(1 - Math.abs(speedRatio) * (1 - maxSquash), my.sprite.player.scaleY); 

        if (groundedNow && !this.wasGrounded) {
            // Trigger landing VFX only on landing
            my.vfx.landing.x = my.sprite.player.x;
            my.vfx.landing.y = my.sprite.player.y + my.sprite.player.displayHeight - 20;
            my.vfx.landing.start();
            this.time.delayedCall(10, () => {
                my.vfx.landing.stop(); // stop the jump vfx
            });

            // Play landing sound
            //this.jumpSound.play();

            // Stretch and squash effect
            my.sprite.player.setScale(0.8, 1.2);  // squash down

            this.tweens.add({
                targets: my.sprite.player,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Bounce.easeOut'
            });
        }

        // Update for next frame
        this.wasGrounded = groundedNow;

        // Track how many consecutive frames the player is grounded
        if (groundedNow) {
            this.coyoteTime = this.COYOTE_DURATION;
            this.hasJumped = false;
        } else {
            this.groundedFrames = 0;
            this.coyoteTime -= delta;
        }

        if (Phaser.Input.Keyboard.JustDown(cursors.up) || Phaser.Input.Keyboard.JustDown(this.spaceKey)) this.jumpBufferRemaining = this.JUMP_BUFFER_DURATION;
        else this.jumpBufferRemaining -= delta; // decrement jump buffer time

        // player jump
        // note that we need body.blocked rather than body.touching b/c the former applies to tilemap tiles and the latter to the "ground"
        if(!groundedNow) {
            my.sprite.player.anims.play('jump');
        }
        if(!this.inputLocked && this.coyoteTime > 0 && this.jumpBufferRemaining > 0 && !this.hasJumped) {
            this.hasJumped = true; // set jump flag to true
            this.coyoteTime = 0; // reset coyote time
            this.jumpBufferRemaining = 0; // reset jump buffer time
            my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);

            // Play jump vfx
            my.vfx.jumping.x = my.sprite.player.x; // center the particle on the player
            my.vfx.jumping.y = my.sprite.player.y + my.sprite.player.displayHeight - 20; // center the particle on the player
            my.vfx.jumping.start();
            this.time.delayedCall(10, () => {
                my.vfx.jumping.stop(); // stop the jump vfx
            });

            // Play jump sound
            this.jumpSound.play();

            // Stretch and squash effect
            my.sprite.player.setScale(1.2, 0.8);  // stretch up, squash wide

            this.tweens.add({
                targets: my.sprite.player,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Sine.easeOut'
            });

        }

        // Cut jump short if player releases key while still rising
        if (my.sprite.player.body.velocity.y < 0 && !(cursors.up.isDown || this.spaceKey.isDown)) {
            // Cut the jump
            my.sprite.player.setVelocityY(Math.max(my.sprite.player.body.velocity.y, this.JUMP_CUTOFF_VELOCITY));
        }

        // If below world
        if(my.sprite.player.y > this.scale.height) {
            my.sprite.player.setPosition(this.lastSafePosition[0], this.lastSafePosition[1]); // respawn at spawn point
            my.sprite.player.setVelocity(0, 0); // reset velocity
            my.sprite.player.setAcceleration(0, 0); // reset acceleration
            my.sprite.player.setDrag(0, 0); // reset drag
            this.inputLocked = true;
            this.time.delayedCall(200, () => {
                this.inputLocked = false;
            });
        }

        if (groundedNow) {
            const tile = this.groundLayer.getTileAtWorldXY(my.sprite.player.x, my.sprite.player.y + my.sprite.player.height / 2);
            //console.log(tile.properties);
            if (tile && tile.properties.safeGround) {
                this.lastSafePosition = [my.sprite.player.x, my.sprite.player.y];
                //console.log("Safe spawn point updated to: ", this.lastSafePosition);
            }
        }
    }

    setupScore() {
        // Save player score
        let playerScore = this.registry.get('playerScore') || 0;
        this.registry.set('playerScore', playerScore);
        
        let xPos = 1140;
        let yPos = 490;
        let fontSize = 12;
        // Add score text
        this.displayScore = this.add.bitmapText(xPos, yPos, 'myFont', 'Score: ' + this.registry.get('playerScore'), fontSize);
        this.displayScore.setScrollFactor(0); // Make it not scroll with the camera

        // Add high score text
        this.displayHighScore = this.add.bitmapText(xPos, yPos + 25, 'myFont', 'High: ' + (parseInt(localStorage.getItem('highScore')) || 0), fontSize);
        this.displayHighScore.setScrollFactor(0); // Make it not scroll with the camera

        // Move to front
        this.displayScore.setDepth(this.UI_DEPTH);
        this.displayHighScore.setDepth(this.UI_DEPTH);
    }

    updateScore(givenPoints) {
        let score = this.registry.get('playerScore') + givenPoints;
        this.registry.set('playerScore', score);
        this.displayScore.setText('Score: ' + this.registry.get('playerScore'));
    }

    addButtons() {
        // Restart game button
        // Create a semi-transparent overlay
        this.buttonRect = this.add.rectangle(this.scale.width/2, this.scale.height/2 + 20, 200, 60, 0x000000, 0.5);
        this.buttonRect.setOrigin(0.5, 0.5);
        this.buttonRect.setScrollFactor(0); // Make it not scroll with the camera
        this.buttonRect.setVisible(false); // Hide the rectangle initially
        this.buttonRect.setDepth(this.UI_DEPTH); // Ensure it appears above other elements

        // Display "Game Over" text
        this.gameOverText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 50, "Game over", {
            fontSize: "32px",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 5
        }).setOrigin(0.5);
        this.gameOverText.setVisible(false); // Hide the text initially
        this.gameOverText.setScrollFactor(0); // Make it not scroll with the camera

        // Restart button
        this.restartButton = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, "Play Again", {
            fontSize: "24px",
            backgroundColor: "#ffffff",
            color: "#000000",
            padding: { x: 20, y: 10 } // Add padding around the text
        })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
            // Play click sound
            this.sound.play('uiClick', {
                volume: 0.5,
                loop: false
            });
            this.restartGame();
        });
        this.restartButton.setOrigin(0.5, 0.5);
        this.restartButton.setScrollFactor(0); // Make it not scroll with the camera
        this.restartButton.setVisible(false); // Hide the button initially
        this.restartButton.setInteractive(false); // Disable interaction initially
        this.restartButton.setDepth(this.UI_DEPTH); // Ensure it appears above other elements
    }

    addObjects() {
        // TODO: Add createFromObjects here
        // Find coins in the "Objects" layer in Phaser
        // Look for them by finding objects with the name "coin"
        // Assign the coin texture from the tilemap_sheet sprite sheet
        // Phaser docs:
        // https://newdocs.phaser.io/docs/3.80.0/focus/Phaser.Tilemaps.Tilemap-createFromObjects

        this.coins = this.map.createFromObjects("Objects", {
            name: "coin",
            key: "tilemap_sheet",
            frame: 151
        });

        this.diamonds = this.map.createFromObjects("Objects", {
            name: "diamond",
            key: "tilemap_sheet",
            frame: 67
        });

        this.endFlag = this.map.createFromObjects("Objects", {
            name: "flag",
            key: "tilemap_sheet",
            frame: 111
        });
        
        // TODO: Add turn into Arcade Physics here
        // Since createFromObjects returns an array of regular Sprites, we need to convert 
        // them into Arcade Physics sprites (STATIC_BODY, so they don't move) 
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.diamonds, Phaser.Physics.Arcade.STATIC_BODY);
        this.physics.world.enable(this.endFlag, Phaser.Physics.Arcade.STATIC_BODY);

        // Create a Phaser group out of the array this.coins
        // This will be used for collision detection below.
        this.coinGroup = this.add.group(this.coins);
        this.diamondGroup = this.add.group(this.diamonds);
        this.endFlag = this.add.group(this.endFlag);

        // TODO: Add coin collision handler
        // Handle collision detection with coins
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (player, coin) => {
            coin.body.enable = false;

            // Play coin sound
            this.sound.play('coinSound', {
                volume: 0.5,
                loop: false
            });

            // Tween coin to disappear
            this.tweens.add({
                targets: coin,
                y: coin.y - 15,
                alpha: 0,
                duration: 600,
                ease: 'Back.easeOut',
                onComplete: () => coin.destroy()
            });
            this.updateScore(1); // increment score
        });
        this.physics.add.overlap(my.sprite.player, this.diamondGroup, (player, diamond) => {
            diamond.body.enable = false;

            // Play diamond sound
            this.sound.play('diamondSound', {
                volume: 0.5,
                loop: false
            });

            // Tween diamond to disappear
            this.tweens.killTweensOf(diamond);  // Cancel bob
            this.tweens.add({
                targets: diamond,
                y: diamond.y - 15,
                alpha: 0,
                duration: 600,
                ease: 'Back.easeOut',
                onComplete: () => diamond.destroy()
            });
            this.updateScore(5); // increment score
        });
        this.physics.add.overlap(my.sprite.player, this.endFlag, (player, flag) => {
            if (!this.isGameOver) {
                this.isGameOver = true; // prevent multiple triggers
                console.log("You reached the end! Final Score: " + this.score);
                this.gameOver("You win!");

            }
        });

        // Play animations
        this.coinGroup.getChildren().forEach(coin => {
            coin.anims.play('coinSpin');
        });
        this.endFlag.getChildren().forEach(flag => {
            flag.anims.play('flagWave');
        });

        // Diamond bob
        this.diamondGroup.getChildren().forEach(diamond => {
            this.tweens.add({ 
                targets: diamond, 
                y: diamond.y - 3, 
                duration: 400, 
                yoyo: true, 
                repeat: -1, 
                ease: 'Sine.easeInOut',
                delay: Phaser.Math.Between(0, 500) // random stagger up to 300ms
            });
        });

    }
    
    createBubbles(minX, maxX, minY, maxY) {
            my.vfx.bubbles = this.add.particles(0, 0, 'kenny-particles', {
            frame: 'light_02.png',
            x: { min: minX, max: maxX },
            y: { min: minY, max: maxY },
            lifespan: { min: 1000, max: 1500 },
            speedY: { min: -30, max: -60 },   // Float upward
            gravityY: 0,                      // Optional: override global gravity
            scale: { start: 0.03, end: 0.008 }, // Shrink as it rises
            alpha: { start: 1, end: 1 },      // Fade out
            quantity: 2,
            frequency: 75,                   // How often to spawn bubbles
            angle: { min: -5, max: 5 },  // slight drift
            rotate: { start: 0, end: 360 }, // optional spin
            blendMode: 'ADD',
            duration: -1, // Loop indefinitely
        });
    }

    gameOver(text="Game Over") {
        this.buttonRect.setVisible(true); // Show the overlay

        this.gameOverText.setText(text); // Set the text
        this.gameOverText.setVisible(true); // Show the text

        this.restartButton.setVisible(true); // Show the button
        this.restartButton.setInteractive(true); // Enable interaction
        this.inputLocked = true;

        // Play level complete sound
        this.backgroundMusic.setVolume(0.1); // Lower volume
        if (!this.levelCompleteSound.isPlaying) this.levelCompleteSound.play();
    }

    restartGame() {
        this.buttonRect.setVisible(false); // Hide the overlay
        
        this.gameOverText.setVisible(false); // Hide the text

        this.restartButton.setVisible(false); // Hide the button
        this.restartButton.setInteractive(false); // Disable interaction

        let playerScore = this.registry.get('playerScore');
        // Check if the player score is greater than the high score
        if (playerScore > parseInt(localStorage.getItem('highScore')) || !localStorage.getItem('highScore')) {
            localStorage.setItem('highScore', playerScore);
            this.displayHighScore.setText('High: ' + parseInt(localStorage.getItem('highScore')));
        }

        this.registry.set('playerScore', 0);
        this.levelCompleteSound.stop(); // Stop level complete sound
        this.backgroundMusic.setVolume(0.4); // Reset background music volume
        this.scene.stop("level1");
        this.scene.start("level1");
    }
}