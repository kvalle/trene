Pod::Spec.new do |s|
  s.name           = 'ActiveWorkoutNotification'
  s.version        = '0.1.0'
  s.summary        = 'Native active workout system visibility for Trene'
  s.description    = 'Provides the ActivityKit and Android notification adapter.'
  s.license        = 'MIT'
  s.author         = 'Trene'
  s.homepage       = 'https://github.com/kvalle/trene'
  s.platforms      = { :ios => '16.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/kvalle/trene.git' }
  s.static_framework = true
  s.source_files   = 'ios/**/*.{h,m,mm,swift}'
  s.frameworks     = 'ActivityKit', 'UIKit'
  s.dependency 'ExpoModulesCore'
end
