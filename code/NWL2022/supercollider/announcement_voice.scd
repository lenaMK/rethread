(
b = NetAddr.new("127.0.0.1", 57123);    // create the NetAddr

~fft_buf = Buffer.alloc(s,2048,1);
Ndef(\grain_voice_mvt,
	{var sig, pan = 0, pos, cutfreq = [50, 100, 350, 1000, 100], fft, freq, hasFreq, amp_ctrl;
		sig = SoundIn.ar(0);
		# freq, hasFreq = Tartini.kr(sig);
		amp_ctrl = Amplitude.kr(BBandPass.ar(sig, [60, 150, 400, 600, 2000], 0.5)).lag(0.2);
		SendReply.kr(Impulse.kr(30), '/amp', amp_ctrl);
		fft = FFT(~fft_buf, sig);
		// IFFT(~fft_buf);
		sig = PitchShift.ar(sig, 0.2, [1.0, 1.075, 1.2], 0.01, 0.01);
		sig = Mix(sig * [1.0, 0.5, 0.15]);
		//sig = PlayBuf.ar(1, bufnum, BufRateScale.ir(bufnum));
		sig = LPF.ar(sig, 8000);
		sig = HPF.ar(sig, 150);
		sig = BPeakEQ.ar(sig, 1500, 0.2, 10);
		cutfreq.do{|cut|
			sig = BPeakEQ.ar(sig, cut, 0.8, -10);
		};
		// sig = Decimator.ar(sig, rate: 44100, bits: 10.5);
		// sig = (sig * 0.5) + (FreeVerb.ar(sig, 0.2) * 0.5);
		// sig = (sig*0.5) + (sig * (Demand.kr(Dust.kr(LFNoise1.kr(1/2).range(5, 20)) + Impulse.kr(0), 0, Dseq([1, 0], inf))) * 0.5);
		// sig = sig * LFNoise2.kr(1).range(0.1, 1.0);
		sig = Pan2.ar(sig * 1);
		// sig = (sig!2).flatten;
		Out.ar(0, sig);
		Out.ar(2, sig*0.1);
}).play;

OSCdef(\amp, {
	arg msg;
	// msg.postln;
	~amp = msg[3..7];
	~send_led_data.();

}, '/amp');

// TODO: The magnitudes don't work very well, sending them is slow.
~send_led_data = {
	b.sendMsg("/unfold_voice_leds", ~amp[0], ~amp[1], ~amp[2], ~amp[3], ~amp[4]);
};


)

Ndef(\grain_voice_mvt).release(5);
~amp
(
var w, much = 0.02, string, synth;

w = Window.new("gui", Rect(100, 100, 300, 500)).front;
w.view.background_(Color.new255(0).vary);

w.drawFunc = Routine {
	loop {
		var width = w.bounds.width, height = w.bounds.height;
		var num_bins, x_pos = 0;
		/*Pen.fillColor = Color.black;
		Pen.fillRect(w.bounds);*/
		num_bins = ~amp.size;
		~amp.do {| mag, i | var y_pos;
			Pen.strokeColor = Color.new255(255, 0, 0);
			y_pos = ((1.0-mag.pow(0.25))*1)*height;
			Pen.lineTo(Point(x_pos, y_pos));

			x_pos = x_pos + (width/num_bins);
		};
		Pen.perform(\stroke);
		// { x.magnitude.plot('Initial', Rect(200, 600-(200*i), 700, 200)) }.defer
		0.yield
	}
};

{ while { w.isClosed.not } { w.refresh; 0.016.wait; } }.fork(AppClock);

w.front;

)
{ ~magnitudes.plot('Initial', Rect(200, 0, 700, 200)) }.defer
~magnitudes.size