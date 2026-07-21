const API_BASE_URL = 'http://localhost:3000';

function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function stringToArrayBuffer(text) {
    return new TextEncoder().encode(text);
}

function arrayBufferToString(buffer) {
    return new TextDecoder().decode(buffer);
}

/**
 * Sends a structured payload to the C backend for encryption.
 * @param {string} methodName Name of the selected method (e.g., "End-to-End Encryption (E2EE)")
 * @param {string} plainText The raw message content
 * @param {string} recipientType Target medium ("Email" or "Phone Number")
 * @param {string} recipient Actual endpoint value
 * @returns {Promise<{encrypted_data: string, generated_key: string}>}
 */
export async function sendEncryptionRequest(methodName, plainText, recipientType, recipient) {
    try {
        const response = await fetch(`${API_BASE_URL}/encrypt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: methodName,
                message: plainText,
                recipient_type: recipientType,
                recipient: recipient
            })
        });

        if (!response.ok) {
            let errText = `Server status returned: ${response.status}`;
            try {
                const errJson = await response.json();
                if (errJson && (errJson.error || errJson.message)) {
                    errText += ` - ${errJson.error || errJson.message}`;
                }
            } catch (e) {
                // ignore JSON parse errors, keep plain status
            }
            throw new Error(errText);
        }

        return await response.json();
    } catch (error) {
        console.error('Network execution failure:', error);
        throw error;
    }
}

/**
 * Sends encrypted data to the C backend for decryption.
 * @param {string} methodName Name of the selected method
 * @param {string} encryptedData The base64-encoded encrypted payload
 * @param {string} otp One-time password for verification
 * @param {string} encryptionKey The base64-encoded key+IV token
 * @returns {Promise<{message: string}>}
 */
export async function sendDecryptionRequest(methodName, encryptedData, otp, encryptionKey) {
    try {
        const response = await fetch(`${API_BASE_URL}/decrypt`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                method: methodName,
                encrypted_data: encryptedData,
                otp: otp,
                encryption_key: encryptionKey
            })
        });

        if (!response.ok) {
            let errText = `Server status returned: ${response.status}`;
            try {
                const errJson = await response.json();
                if (errJson && (errJson.error || errJson.message)) {
                    errText += ` - ${errJson.error || errJson.message}`;
                }
            } catch (e) {
                // ignore
            }
            throw new Error(errText);
        }

        return await response.json();
    } catch (error) {
        console.error('Decryption request failed:', error);
        throw error;
    }
}

export async function generateLocalEncryption(methodName, plainText, recipientType, recipient) {
    const key = await crypto.subtle.generateKey(
        { name: 'AES-CBC', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    const iv = crypto.getRandomValues(new Uint8Array(16));

    const payload = JSON.stringify({
        method: methodName,
        message: plainText,
        recipient_type: recipientType,
        recipient: recipient
    });

    const encryptedBuffer = await crypto.subtle.encrypt(
        { name: 'AES-CBC', iv },
        key,
        stringToArrayBuffer(payload)
    );

    const encryptedData = bufferToBase64(encryptedBuffer);
    const keyIv = new Uint8Array(rawKey.length + iv.length);
    keyIv.set(rawKey, 0);
    keyIv.set(iv, rawKey.length);

    return {
        encrypted_data: encryptedData,
        generated_key: bufferToBase64(keyIv.buffer)
    };
}

export async function decryptLocalPayload(encryptedData, encryptionKey) {
    const ciphertext = base64ToArrayBuffer(encryptedData);
    const keyIv = new Uint8Array(base64ToArrayBuffer(encryptionKey));
    if (keyIv.length !== 48) {
        throw new Error('Invalid encryption key length');
    }

    const rawKey = keyIv.slice(0, 32);
    const iv = keyIv.slice(32);
    const cryptoKey = await crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-CBC' },
        false,
        ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv },
        cryptoKey,
        ciphertext
    );

    return JSON.parse(arrayBufferToString(decryptedBuffer));
}

export async function sendOtpRequest(recipientType, recipient) {
    // OTP is mocked in the frontend for the current prototype.
    return Promise.resolve({ success: true, message: 'OTP mock sent' });
}