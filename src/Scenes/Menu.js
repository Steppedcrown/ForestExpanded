class Menu extends Phaser.Scene {
    constructor() {
        super('menu');
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Overlay background
        this.add.rectangle(0, 0, centerX * 2, centerY * 2, 0x000000, 0.6).setOrigin(0);

        // Title
        this.add.bitmapText(centerX, centerY - 100, 'myFont', 'Forest of Advantis', 24).setOrigin(0.5);

        // High Score Display
        this.displayHighScore = this.add.bitmapText(100, 350, 'myFont', 'High Score: ' + (parseInt(localStorage.getItem('highScore')) || 0), 24);

        // Rotate text
        this.displayHighScore.rotation = Phaser.Math.DegToRad(-35);

        // Pulsate size
        this.tweens.add({
            targets: this.displayHighScore,
            scale: { from: 1, to: 1.3 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Controls text
        let controlText = "a/d: Move Left/Right\n\n" +
                      "space: Jump\n\n" +
                      "esc: Pause\n\n" +
                      "r: Respawn at Checkpoint\n\n" +
                      "p: Skip to end of level\n\n";
        this.controls = this.add.bitmapText(centerX - 500, centerY - 10, 'myFont', controlText, 16).setOrigin(0.5, 0).setVisible(false);

        // Credits
        let creditsText = "Created by: Aiden Waldorf\n\n" + 
        "Visuals by Kenney Assets\n\n" +
        "Audio: Mixkit, Pixabay\n\n" +
        "(See README for full attributions)\n\n";
        this.credits = this.add.bitmapText(centerX + 500, centerY - 10, 'myFont', creditsText, 16).setOrigin(0.5, 0).setVisible(false);

        // Click sfx
        this.click = this.sound.add('uiClick', {
            volume: 0.2
        });

        this.offsetY = 0; // Offset for button positioning
        this.incrementY = 40; // Increment for button spacing
        // Helper function to create buttons with highlight background
        const makeButton = (text, y, callback) => {
            const label = this.add.bitmapText(centerX, y, 'myFont', text, 16).setOrigin(0.5);

            const padding = 4; // Padding around the text
            const width = label.width + padding * 2;
            const height = label.height + padding * 2;

            const bg = this.add.rectangle(label.x, label.y, width, height, 0xffff00, 0.3);
            bg.setVisible(false);

            label.setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.click.play()) // Play button click sound
                .on('pointerdown', callback)
                .on('pointerover', () => bg.setVisible(true))
                .on('pointerout', () => bg.setVisible(false));
            this.offsetY += this.incrementY; // Increment offset for next button  
        };

        if (localStorage.getItem('savedCheckpoint')) {
            makeButton('[ Continue ]', centerY, () => {
                this.input.enabled = false; // Prevent double clicking
                this.tweens.add({
                    targets: this.cameras.main,
                    alpha: 0,               // Fade to invisible
                    duration: 800,
                    ease: 'Linear',
                    onComplete: () => {
                        this.scene.resume('level1');   // Resume level1 if it was paused
                        this.scene.get('level1').inputLocked = false;   // Unlock input
                        this.scene.stop();             // Remove the menu overlay
                    }
                });
            });
        }

        // New game Button
        makeButton('[ New Game ]', centerY + this.offsetY, () => {
            this.input.enabled = false;

            this.tweens.add({
                targets: this.cameras.main,
                alpha: 0,
                duration: 800,
                ease: 'Linear',
                onComplete: () => {
                    // Reset and restart level
                    this.registry.set('playerScore', 0);
                    let highScore = parseInt(localStorage.getItem('highScore')) || 0;
                    localStorage.clear();
                    localStorage.setItem('highScore', highScore); // Reset high score
                    this.scene.start('level1');
                    this.scene.get('level1').inputLocked = false;
                    this.scene.stop(); // stop menu
                }
            });
        });

        // Controls
        makeButton('[ Controls ]', centerY + this.offsetY, () => {
            this.controls.setVisible(!this.controls.visible);
        });

        // Credits
        makeButton('[  Credits  ]', centerY + this.offsetY, () => {
            this.credits.setVisible(!this.credits.visible);
        });

        // Quit Button
        makeButton('[ Quit Game ]', centerY + this.offsetY, () => {
            window.close();
            window.open('', '_self')?.close();
        });

        makeButton('[ Reset High Score ]', centerY + this.offsetY + this.incrementY, () => {
            localStorage.setItem('highScore', 0);
            this.displayHighScore.setText('High Score: 0');
        });

        makeButton('[ Reset Browser Cache ]', centerY + this.offsetY + this.incrementY, () => {
            localStorage.clear();
            this.displayHighScore.setText('High Score: 0');
        });
    }

    fadeOutAndStart() {
        this.cameras.main.fadeOut(800, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.get('level1').inputLocked = false;
            this.scene.stop();
        });
    }
}
