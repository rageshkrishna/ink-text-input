import React, {useState} from 'react';
import test from 'ava';
import chalk from 'chalk';
import {render} from 'ink-testing-library';
import {spy} from 'sinon';
import delay from 'delay';
import TextInput, {UncontrolledTextInput} from '../source/index.js';

const noop = () => {
	/* */
};

const cursor = chalk.inverse(' ');
const enter = '\r';
const arrowLeft = '\u001B[D';
const arrowRight = '\u001B[C';
const del = '\u007F';

test('default state', t => {
	const {lastFrame} = render(<TextInput value="" onChange={noop} />);

	t.is(lastFrame(), cursor);
});

test('display value', t => {
	const {lastFrame} = render(
		<TextInput value="Hello" showCursor={false} onChange={noop} />,
	);

	t.is(lastFrame(), 'Hello');
});

test('display value with cursor', t => {
	const {lastFrame} = render(<TextInput value="Hello" onChange={noop} />);

	t.is(lastFrame(), `Hello${cursor}`);
});

test('display placeholder', t => {
	const {lastFrame} = render(
		<TextInput value="" placeholder="Placeholder" onChange={noop} />,
	);

	t.is(lastFrame(), chalk.inverse('P') + chalk.grey('laceholder'));
});

test('display placeholder when cursor is hidden', t => {
	const {lastFrame} = render(
		<TextInput
			value=""
			placeholder="Placeholder"
			showCursor={false}
			onChange={noop}
		/>,
	);

	t.is(lastFrame(), chalk.grey('Placeholder'));
});

test('display value with mask', t => {
	const {lastFrame} = render(
		<TextInput value="Hello" mask="*" onChange={noop} />,
	);

	t.is(lastFrame(), `*****${chalk.inverse(' ')}`);
});

test('accept input (controlled)', async t => {
	function StatefulTextInput() {
		const [value, setValue] = useState('');

		return <TextInput value={value} onChange={setValue} />;
	}

	const {stdin, lastFrame} = render(<StatefulTextInput />);

	t.is(lastFrame(), cursor);
	await delay(100);
	stdin.write('X');
	await delay(100);
	t.is(lastFrame(), `X${cursor}`);
});

test('accept input (uncontrolled)', async t => {
	const {stdin, lastFrame} = render(<UncontrolledTextInput />);

	t.is(lastFrame(), cursor);
	await delay(100);
	stdin.write('X');
	await delay(100);
	t.is(lastFrame(), `X${cursor}`);
});

test('initial value (uncontrolled)', async t => {
	const {stdin, lastFrame} = render(<UncontrolledTextInput initialValue="Y" />);

	t.is(lastFrame(), `Y${cursor}`);
	await delay(100);
	stdin.write('X');
	await delay(100);
	t.is(lastFrame(), `YX${cursor}`);
});

test('ignore input when not in focus', async t => {
	function StatefulTextInput() {
		const [value, setValue] = useState('');

		return <TextInput focus={false} value={value} onChange={setValue} />;
	}

	const {stdin, frames, lastFrame} = render(<StatefulTextInput />);

	t.is(lastFrame(), '');
	await delay(100);
	stdin.write('X');
	await delay(100);
	t.is(frames.length, 1);
});

test('ignore input for Tab and Shift+Tab keys', async t => {
	function Test() {
		const [value, setValue] = useState('');

		return <TextInput value={value} onChange={setValue} />;
	}

	const {stdin, lastFrame} = render(<Test />);

	await delay(100);
	stdin.write('\t');
	await delay(100);
	t.is(lastFrame(), cursor);
	stdin.write('\u001B[Z');
	await delay(100);
	t.is(lastFrame(), cursor);
});

test('onSubmit', async t => {
	const onSubmit = spy();

	function StatefulTextInput() {
		const [value, setValue] = useState('');

		return <TextInput value={value} onChange={setValue} onSubmit={onSubmit} />;
	}

	const {stdin, lastFrame} = render(<StatefulTextInput />);

	t.is(lastFrame(), cursor);

	await delay(100);
	stdin.write('X');
	await delay(100);
	stdin.write(enter);
	await delay(100);

	t.is(lastFrame(), `X${cursor}`);
	t.true(onSubmit.calledWith('X'));
	t.true(onSubmit.calledOnce);
});

test('paste and move cursor', async t => {
	function StatefulTextInput() {
		const [value, setValue] = useState('');

		return <TextInput highlightPastedText value={value} onChange={setValue} />;
	}

	const {stdin, lastFrame} = render(<StatefulTextInput />);

	await delay(100);
	stdin.write('A');
	await delay(100);
	stdin.write('B');
	await delay(100);
	t.is(lastFrame(), `AB${cursor}`);

	stdin.write(arrowLeft);
	await delay(100);
	t.is(lastFrame(), `A${chalk.inverse('B')}`);

	stdin.write('Hello World');
	await delay(100);
	t.is(lastFrame(), `A${chalk.inverse('Hello WorldB')}`);

	stdin.write(arrowRight);
	await delay(100);
	t.is(lastFrame(), `AHello WorldB${cursor}`);
});

test('delete at the beginning of text', async t => {
	function Test() {
		const [value, setValue] = useState('');

		return <TextInput value={value} onChange={setValue} />;
	}

	const {stdin, lastFrame} = render(<Test />);

	await delay(100);
	stdin.write('T');
	await delay(100);
	stdin.write('e');
	await delay(100);
	stdin.write('s');
	await delay(100);
	stdin.write('t');
	stdin.write(arrowLeft);
	await delay(100);
	stdin.write(arrowLeft);
	await delay(100);
	stdin.write(arrowLeft);
	await delay(100);
	stdin.write(arrowLeft);
	await delay(100);
	stdin.write(del);
	await delay(100);

	t.is(lastFrame(), `${chalk.inverse('T')}est`);
});

test('adjust cursor when text is shorter than last value', async t => {
	function Test() {
		const [value, setValue] = useState('');
		const submit = () => {
			setValue('');
		};

		return <TextInput value={value} onChange={setValue} onSubmit={submit} />;
	}

	const {stdin, lastFrame} = render(<Test />);

	await delay(100);
	stdin.write('A');
	await delay(100);
	stdin.write('B');
	await delay(100);
	t.is(lastFrame(), `AB${chalk.inverse(' ')}`);
	stdin.write('\r');
	await delay(100);
	t.is(lastFrame(), chalk.inverse(' '));
	stdin.write('A');
	await delay(100);
	t.is(lastFrame(), `A${chalk.inverse(' ')}`);
	stdin.write('B');
	await delay(100);
	t.is(lastFrame(), `AB${chalk.inverse(' ')}`);
});

test('sanitize carriage returns in pasted text', async t => {
	function StatefulTextInput() {
		const [value, setValue] = useState('');

		return <TextInput value={value} onChange={setValue} />;
	}

	const {stdin, lastFrame} = render(<StatefulTextInput />);

	await delay(100);
	// Simulate pasting text with \r characters
	stdin.write('Line1\rLine2');
	await delay(100);

	// The \r should be replaced with \n, and we should see both lines
	const output = lastFrame();
	t.true(output?.includes('Line1'));
	t.true(output?.includes('Line2'));
	// Value should have \n instead of \r
	t.regex(output || '', /Line1\nLine2/);
});

test('cursor navigation through multi-line text', async t => {
	function StatefulTextInput() {
		const [value, setValue] = useState('');

		return <TextInput value={value} onChange={setValue} />;
	}

	const {stdin, lastFrame} = render(<StatefulTextInput />);

	await delay(100);
	// Paste multi-line text
	stdin.write('AB\nCD');
	await delay(100);

	// Verify multi-line text is rendered
	const frame = lastFrame();
	t.true(frame?.includes('AB'));
	t.true(frame?.includes('CD'));
	t.true(frame?.includes('\n'));

	// Navigate through the text with arrow keys
	// This tests that cursor navigation works even when cursor crosses newline characters
	stdin.write(arrowLeft); // Move left
	await delay(100);
	stdin.write(arrowLeft); // Move left
	await delay(100);
	stdin.write(arrowLeft); // Move left - cursor should now be on the newline
	await delay(100);
	stdin.write(arrowLeft); // Move left
	await delay(100);

	// After navigating, text should still be intact
	const finalFrame = lastFrame();
	t.true(finalFrame?.includes('AB'));
	t.true(finalFrame?.includes('CD'));

	// Test that we can insert text in the middle after navigating through newlines
	stdin.write('X');
	await delay(100);
	const afterInsert = lastFrame();
	t.true(afterInsert?.includes('X'));
});
