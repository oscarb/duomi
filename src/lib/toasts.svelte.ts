export interface Toast {
	id: string;
	message: string;
	type?: 'success' | 'error' | 'info';
	action?: {
		label: string;
		callback: () => void;
	};
}

class ToastStore {
	list = $state<Toast[]>([]);

	show(
		message: string,
		type: 'success' | 'error' | 'info' = 'success',
		duration = 3500,
		action?: { label: string; callback: () => void }
	) {
		const id = Math.random().toString(36).substring(2, 9);
		this.list = [...this.list, { id, message, type, action }];
		setTimeout(() => {
			this.dismiss(id);
		}, duration);
	}

	dismiss(id: string) {
		this.list = this.list.filter(t => t.id !== id);
	}
}

export const toasts = new ToastStore();
