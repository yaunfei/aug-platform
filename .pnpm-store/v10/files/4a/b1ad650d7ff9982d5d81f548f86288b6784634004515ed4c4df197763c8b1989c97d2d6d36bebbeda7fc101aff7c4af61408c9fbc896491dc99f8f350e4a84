export async function consumeHmrSubscription(subscription, onResult, onUpdate) {
    for await (const result of subscription) {
        onResult(result);
        if (result.type !== "issues") {
            onUpdate(result);
        }
    }
}
