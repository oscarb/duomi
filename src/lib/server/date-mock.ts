if (process.env.TEST_SYSTEM_DATE) {
	const fixedTime = new Date(process.env.TEST_SYSTEM_DATE).getTime();
	if (!isNaN(fixedTime)) {
		const OriginalDate = globalThis.Date;
		// @ts-ignore
		globalThis.Date = class extends OriginalDate {
			constructor(...args: any[]) {
				if (args.length === 0) {
					super(fixedTime);
				} else {
					// @ts-ignore
					super(...args);
				}
			}
			static now() {
				return fixedTime;
			}
		};
	}
}
export {};
