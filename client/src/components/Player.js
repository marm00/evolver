import React, { useEffect, useState } from 'react';

const Player = () => {
    const [position, setPosition] = useState({ x: 100, y: 100 });

    useEffect(() => {
        const handleKeyDown = (e) => {
            let { x, y } = position;

            switch (e.key) {
                case 'ArrowUp':
                    y -= 5;
                    break;
                case 'ArrowDown':
                    y += 5;
                    break;
                case 'ArrowLeft':
                    x -= 5;
                    break;
                case 'ArrowRight':
                    x += 5;
                    break;
                default:
                    break;
            }

            setPosition({ x, y });
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [position]);

    return (
        <div
            style={{
                position: 'absolute',
                top: position.y,
                left: position.x,
                width: '50px',
                height: '50px',
                backgroundColor: 'red',
            }}
        ></div>
    );
};

export default Player;
