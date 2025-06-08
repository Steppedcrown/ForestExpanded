class Menu extends Phaser.Scene {
    constructor() {
        super('menu');
    }

    create() {
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        // Title
        this.add.bitmapText(centerX, centerY - 100, 'myFont', 'Forest of Advantis', 24)
            .setOrigin(0.5);

        // Start Game Button
        const startBtn = this.add.bitmapText(centerX, centerY, 'myFont', '[ Start Game ]', 16)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('level1'));

        // Quit Game Button
        const quitBtn = this.add.bitmapText(centerX, centerY + 40, 'myFont', '[ Quit Game ]', 16)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                // Attempt to close the tab (only works if triggered by user interaction)
                window.close();

                // Fallback: Redirect to a "goodbye" page or blank tab
                window.open('', '_self')?.close();
            });

        // Optional: hover effect
        [startBtn, quitBtn].forEach(btn => {
            btn.on('pointerover', () => btn.setTint(0xffff00));
            btn.on('pointerout', () => btn.clearTint());
        });
    }
}
