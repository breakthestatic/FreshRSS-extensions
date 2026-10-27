<?php

declare(strict_types=1);

final class MarkReadAtBottomExtension extends Minz_Extension {
	#[\Override]
	public function init(): void {
		Minz_View::appendScript($this->getFileUrl('script.js'));
	}
}
