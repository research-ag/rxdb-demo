import React, {useState} from 'react';
import './App.css';
import TodoList from "./components/TodoList";
import {AnonymousIdentity, Identity} from "@dfinity/agent";
import {Ed25519KeyIdentity} from "@dfinity/identity";
import {AuthClient} from "@dfinity/auth-client";

const seedToIdentity: (seed: string) => Identity | null = seed => {
    const seedBuf = new Uint8Array(new ArrayBuffer(32));
    if (seed.length && seed.length > 0 && seed.length <= 32) {
        seedBuf.set(new TextEncoder().encode(seed));
        return Ed25519KeyIdentity.generate(seedBuf);
    }
    return null;
}

function App() {
    const [isLoggedInII, setIsLoggedInII] = useState(false);
    const [identity, setIdentity] = useState<Identity>(new AnonymousIdentity());

    const handleLogin = async () => {
        const authClient = await AuthClient.create();
        try {
            await new Promise<void>((resolve, reject) => {
                authClient.login({
                    onSuccess: () => {
                        resolve();
                    },
                    onError: (error) => {
                        reject(error);
                    },
                });
            });
        } catch (err) {
            console.error(err);
            return;
        }
        setIdentity(authClient.getIdentity());
        setIsLoggedInII(true);
    };

    const handleLogout = async () => {
        setIdentity(new AnonymousIdentity());
        setIsLoggedInII(false);
    };

    const onSeedInput = (seed: string) => {
        let newIdentity = seedToIdentity(seed);
        if (!newIdentity) {
            if (!isLoggedInII) {
                newIdentity = new AnonymousIdentity();
            } else {
                return;
            }
        }
        setIdentity(newIdentity);
        setIsLoggedInII(false);
    }

    return (
        <div style={{display: 'flex', flexDirection: 'column', rowGap: '1rem', padding: '1rem', alignItems: 'stretch'}}>
            <div style={{width: '100%', display: 'flex', justifyContent: 'space-between'}}>
                <span>II login:</span>
                {isLoggedInII ? (
                    <button onClick={handleLogout}>Logout</button>
                ) : (
                    <button onClick={handleLogin}>Log In with Internet Identity</button>
                )}
            </div>
            <div style={{width: '100%', display: 'flex', justifyContent: 'space-between'}}>
                <span>Seed principal:</span>
                <input type="text" onChange={(e) => onSeedInput(e.target.value)}/>
            </div>
            <span><b>Me: {identity.getPrincipal().toText()}</b></span>
            <TodoList identity={identity}></TodoList>
        </div>
    );
}

export default App;
