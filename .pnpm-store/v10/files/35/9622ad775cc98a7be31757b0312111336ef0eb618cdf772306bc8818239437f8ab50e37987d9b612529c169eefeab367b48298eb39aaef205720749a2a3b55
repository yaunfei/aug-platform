export declare class PersistentCacheLock {
    private listener;
    private nativeLockfile;
    private constructor();
    static tryAcquire(lockPath: string, content?: string): PersistentCacheLock | undefined;
    static acquireWithRetries(lockPath: string, processName: string): Promise<PersistentCacheLock>;
    unlock(): Promise<void>;
    unlockSync(): void;
}
export declare function acquirePersistentCacheLock(cacheDirectory: string, processName: string, persistentCaching: boolean): Promise<PersistentCacheLock | undefined>;
