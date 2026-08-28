% Load the profile data
data = readmatrix("profile_smoothed.txt");

% Sample index
x = 1:length(data);

% Plot
figure;
plot(x, data, 'LineWidth', 1.5);

grid on;
xlabel('Sample');
ylabel('ESC Pulse Width (\mus)');
title('Smoothed BLDC Motor Control Profile');
ylim([1000 2000]);
