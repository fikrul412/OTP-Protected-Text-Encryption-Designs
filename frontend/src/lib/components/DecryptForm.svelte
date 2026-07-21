<script>
    import { sendOtpRequest, decryptLocalPayload } from '$lib/services/api.js';

    let encryptedData = $state("");
    let encryptionKey = $state("");
    let otp = $state("");
    let decryptedMessage = $state("");
    let errorLog = $state("");
    let recipientType = $state("");
    let recipient = $state("");
    let metadataExtracted = $state(false);
    let otpSent = $state(false);
    let messageUnlocked = $state(false);
    let localPayload = null;

    const methods = [
        {
            name: "Server Side Encryption",
            requireOtp: true,
            requireKey: false,
            showEncryptionKey: false
        },

        {
            name: "End-to-End Encryption (E2EE)",
            requireOtp: true,
            requireKey: true,
            showEncryptionKey: true
        }
    ];

    let method = $state(methods[0]);

    async function sendOtp() {
        errorLog = "";
        otp = "";
        decryptedMessage = "";
        recipientType = "";
        recipient = "";
        metadataExtracted = false;
        otpSent = false;
        messageUnlocked = false;

        if (!encryptedData.trim()) {
            errorLog = "Encrypted data cannot be blank.";
            return;
        }

        if (method.name === "End-to-End Encryption (E2EE)") {
            if (!encryptionKey.trim()) {
                errorLog = "Encryption key cannot be blank.";
                return;
            }

            try {
                const payload = await decryptLocalPayload(encryptedData, encryptionKey);
                recipientType = payload.recipient_type || "";
                recipient = payload.recipient || "";
                localPayload = payload;
                metadataExtracted = true;
            } catch (err) {
                errorLog = "Unable to extract recipient metadata locally. Check the encrypted data and key.";
                return;
            }
        } else {
            recipientType = sessionStorage.getItem('server_recipient_type') || "";
            recipient = sessionStorage.getItem('server_recipient') || "";
            metadataExtracted = !!recipientType || !!recipient;
        }

        if (!recipientType || !recipient) {
            errorLog = "Could not determine recipient metadata from the provided payload.";
            return;
        }

        try {
            const result = await sendOtpRequest(recipientType, recipient);
            if (result && result.success) {
                otpSent = true;
            } else {
                errorLog = "OTP request failed; please verify the recipient.";
            }
        } catch (err) {
            errorLog = err.message || "OTP request failed.";
        }
    }

    async function decrypt() {
        errorLog = "";
        decryptedMessage = "";

        if (!encryptedData.trim()) {
            errorLog = "Encrypted data cannot be blank.";
            return;
        }

        if (!otp.trim()) {
            errorLog = "OTP cannot be blank.";
            return;
        }

        let keyToSend = encryptionKey;
        if (method.name === "Server Side Encryption") {
            keyToSend = sessionStorage.getItem('server_encryption_key') || "";
            if (!keyToSend.trim()) {
                errorLog = "Server-side encryption key is missing. Encrypt first in this browser session.";
                return;
            }
        }

        if (!keyToSend.trim()) {
            errorLog = "Encryption key cannot be blank.";
            return;
        }

        try {
            const payload = await decryptLocalPayload(encryptedData, keyToSend);
            decryptedMessage = payload.message || "";
            messageUnlocked = true;
        } catch (err) {
            errorLog = "Unable to decrypt locally; check the encryption key and data.";
            decryptedMessage = "";
        }
    }
</script>

<div class="form">
    {#if errorLog}
        <div class="error-banner">{errorLog}</div>
    {/if}

    <label for="method">
        Decryption Method
    </label>

    <select
        id="method"
        bind:value={method}
    >
        {#each methods as item}
            <option value={item}>
                {item.name}
            </option>
        {/each}
    </select>


    <label for="encrypted-data">
        Encrypted Data
    </label>

    <textarea
        id="encrypted-data"
        bind:value={encryptedData}
        placeholder="Paste encrypted data..."
    ></textarea>


    {#if method.requireOtp}

        <button
            type="button"
            onclick={sendOtp}
        >
            {method.name === "End-to-End Encryption (E2EE)"
                ? "Extract recipient and request OTP"
                : "Request OTP"}
        </button>

        {#if metadataExtracted}
            <div class="metadata-preview">
                <div><strong>Recipient Type:</strong> {recipientType}</div>
                <div><strong>Recipient:</strong> {recipient}</div>
            </div>
        {/if}

        {#if otpSent}
            <div class="otp-note">Mock OTP sent. Enter the OTP below to unlock the message.</div>
        {/if}

        {#if method.name === "End-to-End Encryption (E2EE)"}
            <div class="otp-note">E2EE decrypt is local: the payload is only released after mocked OTP verification.</div>
        {:else}
            <div class="otp-note">Server-side decrypt is currently mocked: the browser uses the hidden session key after OTP.</div>
        {/if}

        <label for="otp">
            OTP
        </label>

        <input
            id="otp"
            type="text"
            bind:value={otp}
            placeholder="Enter the OTP..."
        />



    {/if}


    {#if method.showEncryptionKey}

        <label for="key">
            Encryption Key
        </label>

        <textarea
            id="key"
            bind:value={encryptionKey}
            placeholder="Paste the encryption key..."
        ></textarea>

    {/if}


    <button onclick={decrypt} disabled={!otpSent}>
        Decrypt
    </button>


    <label for="decrypted-message">
        Decrypted Message
    </label>

    <textarea
        id="decrypted-message"
        readonly
        bind:value={decryptedMessage}
        placeholder="Decrypted message will appear here..."
    ></textarea>
</div>

<style>
    .form {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
        max-width: 600px;
    }

    textarea {
        min-height: 120px;
        resize: vertical;
    }

    input,
    select,
    textarea,
    button {
        padding: 0.6rem;
        font-size: 1rem;
    }

    button {
        cursor: pointer;
    }

    .error-banner {
        color: #721c24;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        padding: 0.6rem;
        border-radius: 4px;
    }
</style>